import { z } from "zod";

export const initiatePaymentSchema = z.object({
	params: z.object({ attemptId: z.uuid() }),
	body: z.object({
		paymentMethodId: z.string().min(3).optional(),
	}),
});

export const confirmPaymentSchema = z.object({
	params: z.object({ paymentId: z.uuid() }),
	body: z.object({
		paymentMethodId: z.string().min(3),
	}),
});
