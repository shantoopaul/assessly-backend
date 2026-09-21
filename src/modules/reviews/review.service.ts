import { AttemptStatus, type Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
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
