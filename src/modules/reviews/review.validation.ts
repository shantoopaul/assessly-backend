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

export const evaluateSchema = z.object({
	params: z.object({ attemptId: z.uuid() }),
	body: z.object({
		feedback: z.string().trim().min(3).max(5000),
		answers: z
			.array(
				z.object({
					answerId: z.uuid(),
					score: z.number().min(0),
					feedback: z.string().trim().max(2000).optional(),
				}),
			)
			.default([]),
	}),
});
