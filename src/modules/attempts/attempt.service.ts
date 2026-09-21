import { Prisma } from "../../../generated/prisma/client";
import {
	AssessmentStatus,
	AttemptStatus,
	QuestionType,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";
import { buildMeta, getPagination } from "../../utils/pagination";

export const enroll = async (candidateId: string, assessmentId: string) => {
	try {
		const attempt = await prisma.$transaction(
			async (tx) => {
				const assessment = await tx.assessment.findFirst({
					where: {
						id: assessmentId,
						deletedAt: null,
						status: AssessmentStatus.PUBLISHED,
					},
				});
				if (!assessment)
					throw new AppError(404, "Published assessment not found");

				const active = await tx.attempt.findFirst({
					where: {
						candidateId,
						assessmentId,
						status: {
							in: [
								AttemptStatus.PENDING_PAYMENT,
								AttemptStatus.READY,
								AttemptStatus.IN_PROGRESS,
								AttemptStatus.SUBMITTED,
								AttemptStatus.UNDER_REVIEW,
							],
						},
					},
				});
				if (active) {
					throw new AppError(
						409,
						"You already have an active attempt for this assessment",
					);
				}

				const latest = await tx.attempt.findFirst({
					where: { candidateId, assessmentId },
					orderBy: { attemptNo: "desc" },
					select: { attemptNo: true },
				});

				return tx.attempt.create({
					data: {
						candidateId,
						assessmentId,
						attemptNo: (latest?.attemptNo ?? 0) + 1,
						status:
							assessment.feeCents > 0
								? AttemptStatus.PENDING_PAYMENT
								: AttemptStatus.READY,
					},
					include: {
						assessment: {
							select: {
								id: true,
								title: true,
								feeCents: true,
								currency: true,
								durationMinutes: true,
							},
						},
					},
				});
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
		);

		await writeAuditLog(candidateId, "ATTEMPT_ENROLL", "Attempt", attempt.id, {
			assessmentId,
		});
		return attempt;
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2034"
		) {
			throw new AppError(
				409,
				"Enrollment conflicted with another request; retry once",
			);
		}
		throw error;
	}
};

export const start = async (candidateId: string, attemptId: string) => {
	const now = new Date();

	const result = await prisma.$transaction(async (tx) => {
		const attempt = await tx.attempt.findFirst({
			where: {
				id: attemptId,
				candidateId,
				deletedAt: null,
			},
			include: {
				assessment: {
					select: { durationMinutes: true },
				},
			},
		});
		if (!attempt) throw new AppError(404, "Attempt not found");
		if (attempt.status === AttemptStatus.IN_PROGRESS) return attempt;
		if (attempt.status !== AttemptStatus.READY) {
			throw new AppError(409, "Attempt is not ready to start");
		}

		const expiresAt = new Date(
			now.getTime() + attempt.assessment.durationMinutes * 60_000,
		);
		const updated = await tx.attempt.updateMany({
			where: {
				id: attemptId,
				candidateId,
				status: AttemptStatus.READY,
			},
			data: {
				status: AttemptStatus.IN_PROGRESS,
				startedAt: now,
				expiresAt,
			},
		});
		if (updated.count !== 1) {
			throw new AppError(409, "Attempt state changed; reload and try again");
		}

		return tx.attempt.findUniqueOrThrow({
			where: { id: attemptId },
			include: {
				assessment: {
					select: {
						id: true,
						title: true,
						durationMinutes: true,
						passingScore: true,
						questions: {
							where: { deletedAt: null },
							orderBy: { order: "asc" },
							select: {
								id: true,
								prompt: true,
								type: true,
								options: true,
								points: true,
								order: true,
							},
						},
					},
				},
			},
		});
	});

	await writeAuditLog(candidateId, "ATTEMPT_START", "Attempt", attemptId);
	return result;
};

const jsonEqual = (a: unknown, b: unknown) =>
	JSON.stringify(a) === JSON.stringify(b);

export const saveAnswer = async (
	candidateId: string,
	attemptId: string,
	questionId: string,
	response: unknown,
) => {
	const attempt = await prisma.attempt.findFirst({
		where: {
			id: attemptId,
			candidateId,
			deletedAt: null,
		},
	});
	if (!attempt) throw new AppError(404, "Attempt not found");
	if (attempt.status !== AttemptStatus.IN_PROGRESS) {
		throw new AppError(
			409,
			"Answers can only be saved during an in-progress attempt",
		);
	}
	if (attempt.expiresAt && attempt.expiresAt <= new Date()) {
		throw new AppError(409, "Assessment time has expired");
	}

	const question = await prisma.question.findFirst({
		where: {
			id: questionId,
			assessmentId: attempt.assessmentId,
			deletedAt: null,
		},
	});
	if (!question)
		throw new AppError(404, "Question not found in this assessment");

	const autoScore =
		question.type === QuestionType.MCQ && question.correctAnswer !== null
			? jsonEqual(response, question.correctAnswer)
				? question.points
				: 0
			: null;

	return prisma.answer.upsert({
		where: {
			attemptId_questionId: {
				attemptId,
				questionId,
			},
		},
		create: {
			attemptId,
			questionId,
			response: response as Prisma.InputJsonValue,
			autoScore,
		},
		update: {
			response: response as Prisma.InputJsonValue,
			autoScore,
		},
		select: {
			id: true,
			questionId: true,
			response: true,
			updatedAt: true,
		},
	});
};

export const submit = async (candidateId: string, attemptId: string) => {
	const result = await prisma.$transaction(async (tx) => {
		const attempt = await tx.attempt.findFirst({
			where: {
				id: attemptId,
				candidateId,
				deletedAt: null,
			},
			include: {
				assessment: {
					include: {
						questions: {
							where: { deletedAt: null },
							select: { id: true, points: true, type: true },
						},
					},
				},
				answers: true,
			},
		});

		if (!attempt) throw new AppError(404, "Attempt not found");
		if (attempt.status !== AttemptStatus.IN_PROGRESS) {
			throw new AppError(409, "Only an in-progress attempt can be submitted");
		}

		const answerMap = new Map(
			attempt.answers.map((answer) => [answer.questionId, answer]),
		);
		const autoScore = attempt.assessment.questions.reduce((sum, question) => {
			const answer = answerMap.get(question.id);
			return sum + (answer?.autoScore ?? 0);
		}, 0);

		const updated = await tx.attempt.updateMany({
			where: {
				id: attemptId,
				candidateId,
				status: AttemptStatus.IN_PROGRESS,
			},
			data: {
				status: AttemptStatus.SUBMITTED,
				submittedAt: new Date(),
				autoScore,
			},
		});

		if (updated.count !== 1) {
			throw new AppError(409, "Attempt was already submitted");
		}

		return tx.attempt.findUniqueOrThrow({
			where: { id: attemptId },
			select: {
				id: true,
				status: true,
				submittedAt: true,
				autoScore: true,
			},
		});
	});

	await writeAuditLog(candidateId, "ATTEMPT_SUBMIT", "Attempt", attemptId);
	return result;
};

export const listMine = async (
	candidateId: string,
	query: { page: number; limit: number; status?: AttemptStatus },
) => {
	const { page, limit, skip } = getPagination(query.page, query.limit);
	const where: Prisma.AttemptWhereInput = {
		candidateId,
		deletedAt: null,
		...(query.status ? { status: query.status } : {}),
	};

	const [data, total] = await prisma.$transaction([
		prisma.attempt.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				attemptNo: true,
				status: true,
				startedAt: true,
				expiresAt: true,
				submittedAt: true,
				evaluatedAt: true,
				finalScore: true,
				passed: true,
				createdAt: true,
				assessment: {
					select: {
						id: true,
						title: true,
						slug: true,
						difficulty: true,
					},
				},
				payment: {
					select: {
						id: true,
						status: true,
						amountCents: true,
						currency: true,
					},
				},
			},
		}),
		prisma.attempt.count({ where }),
	]);

	return { data, meta: buildMeta(page, limit, total) };
};

export const getCandidateAttempt = async (
	candidateId: string,
	attemptId: string,
) => {
	const summary = await prisma.attempt.findFirst({
		where: {
			id: attemptId,
			candidateId,
			deletedAt: null,
		},
		select: {
			id: true,
			attemptNo: true,
			status: true,
			startedAt: true,
			expiresAt: true,
			submittedAt: true,
			evaluatedAt: true,
			autoScore: true,
			finalScore: true,
			passed: true,
			assessment: {
				select: {
					id: true,
					title: true,
					passingScore: true,
					durationMinutes: true,
					feeCents: true,
					currency: true,
				},
			},
			payment: {
				select: {
					id: true,
					status: true,
					amountCents: true,
					currency: true,
				},
			},
			review: {
				select: {
					feedback: true,
					decision: true,
					totalScore: true,
					createdAt: true,
				},
			},
		},
	});

	if (!summary) throw new AppError(404, "Attempt not found");

	if (!summary.startedAt) {
		return summary;
	}

	return prisma.attempt.findFirstOrThrow({
		where: {
			id: attemptId,
			candidateId,
			deletedAt: null,
		},
		select: {
			id: true,
			attemptNo: true,
			status: true,
			startedAt: true,
			expiresAt: true,
			submittedAt: true,
			evaluatedAt: true,
			autoScore: true,
			finalScore: true,
			passed: true,
			assessment: {
				select: {
					id: true,
					title: true,
					passingScore: true,
					durationMinutes: true,
					questions: {
						where: { deletedAt: null },
						orderBy: { order: "asc" },
						select: {
							id: true,
							prompt: true,
							type: true,
							options: true,
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
			review: {
				select: {
					feedback: true,
					decision: true,
					totalScore: true,
					createdAt: true,
				},
			},
		},
	});
};
