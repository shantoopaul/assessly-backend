import type { Prisma } from "../../../generated/prisma/client";
import {
	AssessmentStatus,
	AttemptStatus,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";
import { buildMeta, getPagination } from "../../utils/pagination";

export const listUsers = async (query: {
	page: number;
	limit: number;
	search?: string;
	role?: Role;
	status?: UserStatus;
	sortOrder: "asc" | "desc";
}) => {
	const { page, limit, skip } = getPagination(query.page, query.limit);
	const where: Prisma.UserWhereInput = {
		deletedAt: null,
		...(query.role ? { role: query.role } : {}),
		...(query.status ? { status: query.status } : {}),
		...(query.search
			? {
					OR: [
						{ name: { contains: query.search, mode: "insensitive" } },
						{ email: { contains: query.search, mode: "insensitive" } },
					],
				}
			: {}),
	};

	const [data, total] = await prisma.$transaction([
		prisma.user.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: query.sortOrder ?? "desc" },
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				status: true,
				avatarUrl: true,
				createdAt: true,
				updatedAt: true,
			},
		}),
		prisma.user.count({ where }),
	]);
	return { data, meta: buildMeta(page, limit, total) };
};

export const updateUserStatus = async (
	adminId: string,
	userId: string,
	status: UserStatus,
) => {
	if (adminId === userId && status === UserStatus.BLOCKED) {
		throw new AppError(409, "You cannot block your own admin account");
	}

	const user = await prisma.user.findFirst({
		where: { id: userId, deletedAt: null },
	});
	if (!user) throw new AppError(404, "User not found");

	const updated = await prisma.user.update({
		where: { id: userId },
		data: {
			status,
			...(status === UserStatus.BLOCKED
				? { tokenVersion: { increment: 1 } }
				: {}),
		},
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			status: true,
		},
	});

	await writeAuditLog(adminId, "ADMIN_USER_STATUS_UPDATE", "User", userId, {
		status,
	});
	return updated;
};

export const updateUserRole = async (
	adminId: string,
	userId: string,
	role: Role,
) => {
	if (adminId === userId && role !== Role.ADMIN) {
		throw new AppError(409, "You cannot remove your own admin role");
	}

	const user = await prisma.user.findFirst({
		where: { id: userId, deletedAt: null },
	});
	if (!user) throw new AppError(404, "User not found");

	const activeWork = await prisma.attempt.count({
		where: {
			OR: [{ candidateId: userId }, { reviewerId: userId }],
			status: {
				in: [
					AttemptStatus.IN_PROGRESS,
					AttemptStatus.SUBMITTED,
					AttemptStatus.UNDER_REVIEW,
				],
			},
		},
	});
	if (activeWork > 0 && user.role !== role) {
		throw new AppError(
			409,
			"User role cannot change while assessment work is active",
		);
	}

	const updated = await prisma.user.update({
		where: { id: userId },
		data: {
			role,
			tokenVersion: { increment: 1 },
		},
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			status: true,
		},
	});

	await writeAuditLog(adminId, "ADMIN_USER_ROLE_UPDATE", "User", userId, {
		role,
	});
	return updated;
};

export const softDeleteUser = async (adminId: string, userId: string) => {
	if (adminId === userId) {
		throw new AppError(409, "You cannot delete your own admin account");
	}

	const user = await prisma.user.findFirst({
		where: { id: userId, deletedAt: null },
	});
	if (!user) throw new AppError(404, "User not found");

	const activeAttempts = await prisma.attempt.count({
		where: {
			OR: [{ candidateId: userId }, { reviewerId: userId }],
			status: {
				in: [
					AttemptStatus.IN_PROGRESS,
					AttemptStatus.SUBMITTED,
					AttemptStatus.UNDER_REVIEW,
				],
			},
		},
	});
	if (activeAttempts > 0) {
		throw new AppError(
			409,
			"User has active assessment work and cannot be deleted",
		);
	}

	await prisma.user.update({
		where: { id: userId },
		data: {
			deletedAt: new Date(),
			status: UserStatus.BLOCKED,
			tokenVersion: { increment: 1 },
		},
	});

	await writeAuditLog(adminId, "ADMIN_USER_SOFT_DELETE", "User", userId);
	return null;
};

export const stats = async () => {
	const [
		users,
		candidates,
		reviewers,
		publishedAssessments,
		attempts,
		evaluated,
		payments,
	] = await prisma.$transaction([
		prisma.user.count({ where: { deletedAt: null } }),
		prisma.user.count({ where: { deletedAt: null, role: Role.CANDIDATE } }),
		prisma.user.count({ where: { deletedAt: null, role: Role.REVIEWER } }),
		prisma.assessment.count({
			where: { deletedAt: null, status: AssessmentStatus.PUBLISHED },
		}),
		prisma.attempt.count({ where: { deletedAt: null } }),
		prisma.attempt.count({ where: { status: AttemptStatus.EVALUATED } }),
		prisma.payment.aggregate({
			where: { status: "SUCCEEDED" },
			_count: { id: true },
			_sum: { amountCents: true },
		}),
	]);

	return {
		users: { total: users, candidates, reviewers },
		assessments: { published: publishedAssessments },
		attempts: { total: attempts, evaluated },
		payments: {
			successfulCount: payments._count.id,
			grossAmountInMinorUnits: payments._sum.amountCents ?? 0,
		},
	};
};

export const auditLogs = async (query: {
	page: number;
	limit: number;
	action?: string;
	entityType?: string;
}) => {
	const { page, limit, skip } = getPagination(query.page, query.limit);
	const where: Prisma.AuditLogWhereInput = {
		...(query.action
			? { action: { contains: query.action, mode: "insensitive" } }
			: {}),
		...(query.entityType
			? { entityType: { contains: query.entityType, mode: "insensitive" } }
			: {}),
	};

	const [data, total] = await prisma.$transaction([
		prisma.auditLog.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				actor: {
					select: {
						id: true,
						name: true,
						email: true,
						role: true,
					},
				},
			},
		}),
		prisma.auditLog.count({ where }),
	]);

	return { data, meta: buildMeta(page, limit, total) };
};
