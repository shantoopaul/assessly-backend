import { z } from "zod";
import { Difficulty } from "../../../generated/prisma/enums";

const slug = z
	.string()
	.trim()
	.min(3)
	.max(100)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

export const createAssessmentSchema = z.object({
	body: z.object({
		title: z.string().trim().min(3).max(150),
		slug,
		description: z.string().trim().min(20).max(5000),
		difficulty: z.enum(Difficulty),
		durationMinutes: z.number().int().min(5).max(480),
		passingScore: z.number().min(0).max(100),
		feeCents: z.number().int().min(0).max(10000000).default(0),
		currency: z
			.string()
			.trim()
			.length(3)
			.transform((bool) => bool.toLowerCase())
			.default("usd"),
	}),
});

export const listAssessmentSchema = z.object({
	query: z.object({
		page: z.coerce.number().int().min(1).default(1),
		limit: z.coerce.number().int().min(1).max(100).default(10),
		search: z.string().trim().max(100).optional(),
		difficulty: z.enum(Difficulty).optional(),
		sortBy: z
			.enum(["createdAt", "title", "feeCents", "durationMinutes"])
			.default("createdAt"),
		sortOrder: z.enum(["asc", "desc"]).default("desc"),
	}),
});

export const idParamSchema = z.object({
	params: z.object({ id: z.uuid() }),
});
