import type { Prisma } from "../../../generated/prisma/client";
import {
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
	if (adminId === userId && status === UserStatus.BLOCKED)
		throw new AppError(409, "You cannot block your own admin account");
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
		select: { id: true, name: true, email: true, role: true, status: true },
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
	if (adminId === userId && role !== Role.ADMIN)
		throw new AppError(409, "You cannot remove your own admin role");
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
	if (activeWork > 0 && user.role !== role)
		throw new AppError(
			409,
			"User role cannot change while assessment work is active",
		);

	const updated = await prisma.user.update({
		where: { id: userId },
		data: { role, tokenVersion: { increment: 1 } },
		select: { id: true, name: true, email: true, role: true, status: true },
	});
	await writeAuditLog(adminId, "ADMIN_USER_ROLE_UPDATE", "User", userId, {
		role,
	});
	return updated;
};
