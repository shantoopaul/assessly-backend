import { AssessmentStatus, type Difficulty, type Prisma, Role } from "../../../generated/prisma/client";
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { writeAuditLog } from '../../utils/audit';
import { clearAssessmentCache, getCache, setCache } from '../../utils/cache';
import { buildMeta, getPagination } from '../../utils/pagination';

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

export const listManaged = async (
	actor: Actor,
	query: {
		page: number;
		limit: number;
		search?: string;
		status?: AssessmentStatus;
	},
) => {
	const { page, limit, skip } = getPagination(query.page, query.limit);
	const where: Prisma.AssessmentWhereInput = {
		deletedAt: null,
		...(actor.role === Role.REVIEWER ? { createdById: actor.id } : {}),
		...(query.status ? { status: query.status } : {}),
		...(query.search
			? {
					OR: [
						{ title: { contains: query.search, mode: "insensitive" } },
						{ slug: { contains: query.search, mode: "insensitive" } },
					],
				}
			: {}),
	};

	const [data, total] = await prisma.$transaction([
		prisma.assessment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { updatedAt: "desc" },
			select: assessmentPublicSelect,
		}),
		prisma.assessment.count({ where }),
	]);

	return { data, meta: buildMeta(page, limit, total) };
};

const assertManager = async (assessmentId: string, actor: Actor) => {
	const assessment = await prisma.assessment.findFirst({
		where: { id: assessmentId, deletedAt: null },
	});
	if (!assessment) throw new AppError(404, "Assessment not found");
	if (actor.role !== Role.ADMIN && assessment.createdById !== actor.id) {
		throw new AppError(403, "You can only manage assessments you created");
	}
	return assessment;
};

export const getManaged = async (id: string, actor: Actor) => {
	await assertManager(id, actor);
	const assessment = await prisma.assessment.findUnique({
		where: { id },
		include: {
			questions: { where: { deletedAt: null }, orderBy: { order: "asc" } },
			_count: { select: { attempts: true } },
		},
	});
	if (!assessment) throw new AppError(404, "Assessment not found");
	return assessment;
};

export const publish = async (id: string, actor: Actor) => {
	const current = await assertManager(id, actor);
	if (current.status === AssessmentStatus.ARCHIVED) {
		throw new AppError(409, "Archived assessments cannot be published");
	}

	const activeQuestions = await prisma.question.count({
		where: { assessmentId: id, deletedAt: null },
	});
	if (activeQuestions === 0) {
		throw new AppError(409, "Add at least one question before publishing");
	}

	const totalPoints = await prisma.question.aggregate({
		where: { assessmentId: id, deletedAt: null },
		_sum: { points: true },
	});
	if (!totalPoints._sum.points) {
		throw new AppError(409, "Assessment must have positive total points");
	}

	const result = await prisma.assessment.update({
		where: { id },
		data: { status: AssessmentStatus.PUBLISHED },
		select: assessmentPublicSelect,
	});

	await clearAssessmentCache();
	await writeAuditLog(actor.id, "ASSESSMENT_PUBLISH", "Assessment", id);
	return result;
};