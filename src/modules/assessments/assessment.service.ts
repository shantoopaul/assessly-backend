import type { Prisma, Role } from "../../../generated/prisma/client";
import {
	AssessmentStatus,
	type Difficulty,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";
import { clearAssessmentCache, getCache, setCache } from "../../utils/cache";
import { buildMeta, getPagination } from "../../utils/pagination";

type Actor = { id: string; role: Role };

export const create = async (
	actor: Actor,
	payload: {
		title: string;
		slug: string;
		description: string;
		difficulty: Difficulty;
		durationMinutes: number;
		passingScore: number;
		feeCents: number;
		currency: string;
	},
) => {
	const result = await prisma.assessment.create({
		data: { ...payload, createdById: actor.id },
		select: assessmentPublicSelect,
	});
	await clearAssessmentCache();
	await writeAuditLog(actor.id, "ASSESSMENT_CREATE", "Assessment", result.id);
	return result;
};

const assessmentPublicSelect = {
	id: true,
	title: true,
	slug: true,
	description: true,
	difficulty: true,
	durationMinutes: true,
	passingScore: true,
	feeCents: true,
	currency: true,
	status: true,
	createdAt: true,
	creator: { select: { id: true, name: true } },
	_count: { select: { questions: { where: { deletedAt: null } } } },
} as const;

export const list = async (query: {
	page: number;
	limit: number;
	search?: string;
	difficulty?: Difficulty;
	status?: AssessmentStatus;
	sortBy: "createdAt" | "title" | "feeCents" | "durationMinutes";
	sortOrder: "asc" | "desc";
}) => {
	const { page, limit, skip } = getPagination(query.page, query.limit);
	const status = AssessmentStatus.PUBLISHED;
	const sortBy = query.sortBy ?? "createdAt";
	const sortOrder = query.sortOrder ?? "desc";

	const cacheKey = `assessments:${JSON.stringify({ ...query, status, sortBy, sortOrder, page, limit })}`;
	const cached = await getCache<{
		data: unknown[];
		meta: ReturnType<typeof buildMeta>;
	}>(cacheKey);
	if (cached) return cached;

	const where: Prisma.AssessmentWhereInput = {
		deletedAt: null,
		status,
		...(query.difficulty ? { difficulty: query.difficulty } : {}),
		...(query.search
			? {
					OR: [
						{ title: { contains: query.search, mode: "insensitive" } },
						{ description: { contains: query.search, mode: "insensitive" } },
					],
				}
			: {}),
	};

	const orderBy = {
		[sortBy]: sortOrder,
	} as Prisma.AssessmentOrderByWithRelationInput;

	const [data, total] = await prisma.$transaction([
		prisma.assessment.findMany({
			where,
			select: assessmentPublicSelect,
			skip,
			take: limit,
			orderBy,
		}),
		prisma.assessment.count({ where }),
	]);

	const result = { data, meta: buildMeta(page, limit, total) };
	await setCache(cacheKey, result, 60);
	return result;
};

export const getById = async (id: string) => {
	const assessment = await prisma.assessment.findFirst({
		where: { id, deletedAt: null, status: AssessmentStatus.PUBLISHED },
		select: assessmentPublicSelect,
	});
	if (!assessment) throw new AppError(404, "Published assessment not found");
	return assessment;
};
