import { z } from "zod";
import { AttemptStatus } from "../../../generated/prisma/enums";

export const assessmentIdSchema = z.object({
	params: z.object({ assessmentId: z.uuid() }),
});

export const attemptIdSchema = z.object({
	params: z.object({ attemptId: z.uuid() }),
});

export const answerSchema = z.object({
	params: z.object({
		attemptId: z.uuid(),
		questionId: z.uuid(),
	}),
	body: z.object({
		response: z.unknown(),
	}),
});

export const myAttemptsSchema = z.object({
	query: z.object({
		page: z.coerce.number().int().min(1).default(1),
		limit: z.coerce.number().int().min(1).max(100).default(10),
		status: z.enum(AttemptStatus).optional(),
	}),
});
