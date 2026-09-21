import {
	AttemptStatus,
	Prisma,
	QuestionType,
	ReviewDecision,
} from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";
import { buildMeta, getPagination } from "../../utils/pagination";

export const queue = async (query: { page: number; limit: number }) => {
	const { page, limit, skip } = getPagination(query.page, query.limit);
	const where: Prisma.AttemptWhereInput = {
		status: AttemptStatus.SUBMITTED,
		reviewerId: null,
		deletedAt: null,
	};

	const [data, total] = await prisma.$transaction([
		prisma.attempt.findMany({
			where,
			skip,
			take: limit,
			orderBy: { submittedAt: "asc" },
			select: {
				id: true,
				submittedAt: true,
				attemptNo: true,
				assessment: {
					select: {
						id: true,
						title: true,
						difficulty: true,
					},
				},
				candidate: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		}),
		prisma.attempt.count({ where }),
	]);

	return { data, meta: buildMeta(page, limit, total) };
};

export const mine = async (
	reviewerId: string,
	query: { page: number; limit: number },
) => {
	const { page, limit, skip } = getPagination(query.page, query.limit);
	const where: Prisma.AttemptWhereInput = {
		reviewerId,
		status: {
			in: [AttemptStatus.UNDER_REVIEW, AttemptStatus.EVALUATED],
		},
	};

	const [data, total] = await prisma.$transaction([
		prisma.attempt.findMany({
			where,
			skip,
			take: limit,
			orderBy: { updatedAt: "desc" },
			select: {
				id: true,
				status: true,
				submittedAt: true,
				evaluatedAt: true,
				finalScore: true,
				passed: true,
				assessment: {
					select: { id: true, title: true },
				},
				candidate: {
					select: { id: true, name: true },
				},
			},
		}),
		prisma.attempt.count({ where }),
	]);

	return { data, meta: buildMeta(page, limit, total) };
};

export const getReviewAttempt = async (
	reviewerId: string,
	attemptId: string,
) => {
	const attempt = await prisma.attempt.findFirst({
		where: {
			id: attemptId,
			reviewerId,
			status: {
				in: [AttemptStatus.UNDER_REVIEW, AttemptStatus.EVALUATED],
			},
		},
		select: {
			id: true,
			status: true,
			autoScore: true,
			finalScore: true,
			passed: true,
			assessment: {
				select: {
					id: true,
					title: true,
					passingScore: true,
					questions: {
						where: { deletedAt: null },
						orderBy: { order: "asc" },
						select: {
							id: true,
							prompt: true,
							type: true,
							options: true,
							correctAnswer: true,
							points: true,
							order: true,
							answers: {
								where: { attemptId },
								select: {
									id: true,
									response: true,
									autoScore: true,
									reviewerScore: true,
									feedback: true,
								},
							},
						},
					},
				},
			},
			candidate: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
			review: true,
		},
	});
	if (!attempt) throw new AppError(404, "Review assignment not found");
	return attempt;
};

export const claim = async (reviewerId: string, attemptId: string) => {
	const result = await prisma.attempt.updateMany({
		where: {
			id: attemptId,
			status: AttemptStatus.SUBMITTED,
			reviewerId: null,
			deletedAt: null,
		},
		data: {
			reviewerId,
			status: AttemptStatus.UNDER_REVIEW,
		},
	});

	if (result.count !== 1) {
		const existing = await prisma.attempt.findUnique({
			where: { id: attemptId },
			select: { reviewerId: true, status: true },
		});
		if (!existing) throw new AppError(404, "Attempt not found");
		throw new AppError(
			409,
			"Attempt has already been claimed or is not reviewable",
		);
	}

	await writeAuditLog(reviewerId, "REVIEW_CLAIM", "Attempt", attemptId);
	return getReviewAttempt(reviewerId, attemptId);
};

export const evaluate = async (
	reviewerId: string,
	attemptId: string,
	payload: {
		feedback: string;
		answers: Array<{ answerId: string; score: number; feedback?: string }>;
	},
) => {
	const result = await prisma.$transaction(
		async (tx) => {
			const attempt = await tx.attempt.findFirst({
				where: {
					id: attemptId,
					reviewerId,
					status: AttemptStatus.UNDER_REVIEW,
				},
				include: {
					assessment: {
						include: {
							questions: {
								where: { deletedAt: null },
							},
						},
					},
					answers: {
						include: { question: true },
					},
				},
			});

			if (!attempt) {
				throw new AppError(
					404,
					"Under-review attempt assigned to you was not found",
				);
			}

			const submittedScores = new Map(
				payload.answers.map((item) => [item.answerId, item]),
			);
			const attemptAnswerIds = new Set(
				attempt.answers.map((answer) => answer.id),
			);
			const unknownAnswer = payload.answers.find(
				(item) => !attemptAnswerIds.has(item.answerId),
			);
			if (unknownAnswer) {
				throw new AppError(
					400,
					"One or more graded answers do not belong to this attempt",
				);
			}

			for (const answer of attempt.answers) {
				if (answer.question.type === QuestionType.MCQ) continue;
				const grade = submittedScores.get(answer.id);
				if (!grade) continue;
				if (grade.score > answer.question.points) {
					throw new AppError(
						400,
						`Score for answer ${answer.id} cannot exceed ${answer.question.points}`,
					);
				}
				await tx.answer.update({
					where: { id: answer.id },
					data: {
						reviewerScore: grade.score,
						feedback: grade.feedback,
					},
				});
			}

			const refreshedAnswers = await tx.answer.findMany({
				where: { attemptId },
				include: { question: true },
			});

			const totalPoints = attempt.assessment.questions.reduce(
				(sum, question) => sum + question.points,
				0,
			);
			if (totalPoints <= 0)
				throw new AppError(409, "Assessment has no scoreable points");

			const earnedPoints = refreshedAnswers.reduce((sum, answer) => {
				if (answer.question.type === QuestionType.MCQ) {
					return sum + (answer.autoScore ?? 0);
				}
				return sum + (answer.reviewerScore ?? 0);
			}, 0);

			const finalScore = Number(
				((earnedPoints / totalPoints) * 100).toFixed(2),
			);
			const passed = finalScore >= attempt.assessment.passingScore;
			const decision = passed ? ReviewDecision.PASS : ReviewDecision.FAIL;

			const review = await tx.review.create({
				data: {
					attemptId,
					reviewerId,
					feedback: payload.feedback,
					totalScore: finalScore,
					decision,
				},
			});

			await tx.attempt.update({
				where: { id: attemptId },
				data: {
					status: AttemptStatus.EVALUATED,
					finalScore,
					passed,
					evaluatedAt: new Date(),
				},
			});

			return review;
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

	await writeAuditLog(reviewerId, "REVIEW_EVALUATE", "Attempt", attemptId, {
		totalScore: result.totalScore,
		decision: result.decision,
	});
	return result;
};
