import { AttemptStatus, type Prisma } from "../../../generated/prisma/client";
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
				assessment: { select: { id: true, title: true, difficulty: true } },
				candidate: { select: { id: true, name: true } },
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
		status: { in: [AttemptStatus.UNDER_REVIEW, AttemptStatus.EVALUATED] },
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
				assessment: { select: { id: true, title: true } },
				candidate: { select: { id: true, name: true } },
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
			status: { in: [AttemptStatus.UNDER_REVIEW, AttemptStatus.EVALUATED] },
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
			candidate: { select: { id: true, name: true, email: true } },
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
		data: { reviewerId, status: AttemptStatus.UNDER_REVIEW },
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
