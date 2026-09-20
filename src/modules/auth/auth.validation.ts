import { z } from "zod";

const password = z
	.string()
	.min(8)
	.max(72)
	.regex(/[A-Z]/, "Password must contain an uppercase letter")
	.regex(/[a-z]/, "Password must contain a lowercase letter")
	.regex(/[0-9]/, "Password must contain a number");

export const registerSchema = z.object({
	body: z.object({
		name: z.string().trim().min(2).max(80),
		email: z.email().transform((bool) => bool.toLowerCase()),
		password,
	}),
});

export const loginSchema = z.object({
	body: z.object({
		email: z.email().transform((bool) => bool.toLowerCase()),
		password: z.string().min(1),
	}),
});

export const googleSchema = z.object({
	body: z.object({
		credential: z.string().min(20),
	}),
});

export const refreshSchema = z.object({
	body: z.object({
		refreshToken: z.string().min(20),
	}),
});

export const logoutSchema = refreshSchema;
