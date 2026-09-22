import { z } from "zod";
import { Role, UserStatus } from "../../../generated/prisma/enums";

export const listUsersSchema = z.object({
	query: z.object({
		page: z.coerce.number().int().min(1).default(1),
		limit: z.coerce.number().int().min(1).max(100).default(10),
		search: z.string().trim().max(100).optional(),
		role: z.enum(Role).optional(),
		status: z.enum(UserStatus).optional(),
		sortOrder: z.enum(["asc", "desc"]).default("desc"),
	}),
});

export const updateStatusSchema = z.object({
	params: z.object({ userId: z.uuid() }),
	body: z.object({ status: z.enum(UserStatus) }),
});

export const updateRoleSchema = z.object({
	params: z.object({ userId: z.uuid() }),
	body: z.object({ role: z.enum(Role) }),
});

export const userIdSchema = z.object({
	params: z.object({ userId: z.uuid() }),
});
