import { z } from "zod";

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
