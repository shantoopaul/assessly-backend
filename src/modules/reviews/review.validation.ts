import { z } from "zod";

export const reviewListSchema = z.object({
	query: z.object({
		page: z.coerce.number().int().min(1).default(1),
		limit: z.coerce.number().int().min(1).max(100).default(10),
	}),
});

export const attemptIdSchema = z.object({
	params: z.object({ attemptId: z.uuid() }),
});
