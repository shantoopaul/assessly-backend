import { z } from "zod";

export const assessmentIdSchema = z.object({
	params: z.object({ assessmentId: z.string().uuid() }),
});

export const attemptIdSchema = z.object({
	params: z.object({ attemptId: z.string().uuid() }),
});