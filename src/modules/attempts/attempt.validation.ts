import { z } from "zod";

export const assessmentIdSchema = z.object({
	params: z.object({ assessmentId: z.string().uuid() }),
});