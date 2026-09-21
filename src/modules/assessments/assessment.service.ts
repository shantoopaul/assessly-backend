import { Prisma } from "../../../generated/prisma/client";
import {
	AssessmentStatus,
	type Difficulty,
	QuestionType,
	Role,
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
	creator: {
		select: {
			id: true,
			name: true,
		},
	},
	_count: {
		select: {
			questions: {
				where: { deletedAt: null },
			},
		},
	},
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
		where: {
			id,
			deletedAt: null,
			status: AssessmentStatus.PUBLISHED,
		},
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
			questions: {
				where: { deletedAt: null },
				orderBy: { order: "asc" },
			},
			_count: {
				select: { attempts: true },
			},
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

const assertNoAttempts = async (assessmentId: string) => {
	const count = await prisma.attempt.count({
		where: { assessmentId, deletedAt: null },
	});
	if (count > 0) {
		throw new AppError(
			409,
			"Assessment content is locked because candidate attempts already exist",
		);
	}
};

export const update = async (
	id: string,
	actor: Actor,
	payload: Record<string, unknown>,
) => {
	const current = await assertManager(id, actor);
	await assertNoAttempts(id);
	if (current.status === AssessmentStatus.ARCHIVED) {
		throw new AppError(409, "Archived assessments cannot be edited");
	}

	const data: Prisma.AssessmentUpdateInput = {};
	if (payload.title !== undefined) data.title = payload.title as string;
	if (payload.slug !== undefined) data.slug = payload.slug as string;
	if (payload.description !== undefined)
		data.description = payload.description as string;
	if (payload.difficulty !== undefined)
		data.difficulty = payload.difficulty as Difficulty;
	if (payload.durationMinutes !== undefined) {
		data.durationMinutes = payload.durationMinutes as number;
	}
	if (payload.passingScore !== undefined)
		data.passingScore = payload.passingScore as number;
	if (payload.feeCents !== undefined)
		data.feeCents = payload.feeCents as number;
	if (payload.currency !== undefined)
		data.currency = payload.currency as string;

	const result = await prisma.assessment.update({
		where: { id },
		data,
		select: assessmentPublicSelect,
	});
	await clearAssessmentCache();
	await writeAuditLog(actor.id, "ASSESSMENT_UPDATE", "Assessment", id);
	return result;
};

export const softDelete = async (id: string, actor: Actor) => {
	await assertManager(id, actor);

	const activeAttempts = await prisma.attempt.count({
		where: {
			assessmentId: id,
			status: {
				in: ["IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW"],
			},
		},
	});
	if (activeAttempts > 0) {
		throw new AppError(
			409,
			"Assessment has active attempts and cannot be deleted",
		);
	}

	await prisma.assessment.update({
		where: { id },
		data: {
			deletedAt: new Date(),
			status: AssessmentStatus.ARCHIVED,
		},
	});

	await clearAssessmentCache();
	await writeAuditLog(actor.id, "ASSESSMENT_SOFT_DELETE", "Assessment", id);
	return null;
};

export const addQuestion = async (
	assessmentId: string,
	actor: Actor,
	payload: {
		prompt: string;
		type: QuestionType;
		options?: string[];
		correctAnswer?: unknown;
		points: number;
		order: number;
	},
) => {
	const assessment = await assertManager(assessmentId, actor);
	await assertNoAttempts(assessmentId);
	if (assessment.status === AssessmentStatus.ARCHIVED) {
		throw new AppError(409, "Archived assessments cannot be edited");
	}

	const data: Prisma.QuestionUncheckedCreateInput = {
		assessmentId,
		prompt: payload.prompt,
		type: payload.type,
		points: payload.points,
		order: payload.order,
		...(payload.options !== undefined
			? { options: payload.options as Prisma.InputJsonValue }
			: {}),
		...(payload.correctAnswer !== undefined
			? { correctAnswer: payload.correctAnswer as Prisma.InputJsonValue }
			: {}),
	};

	const question = await prisma.question.create({ data });
	await clearAssessmentCache();
	await writeAuditLog(actor.id, "QUESTION_CREATE", "Question", question.id, {
		assessmentId,
	});
	return question;
};

export const updateQuestion = async (
	assessmentId: string,
	questionId: string,
	actor: Actor,
	payload: Record<string, unknown>,
) => {
	const assessment = await assertManager(assessmentId, actor);
	await assertNoAttempts(assessmentId);
	if (assessment.status === AssessmentStatus.ARCHIVED) {
		throw new AppError(409, "Archived assessments cannot be edited");
	}

	const question = await prisma.question.findFirst({
		where: { id: questionId, assessmentId, deletedAt: null },
	});
	if (!question) throw new AppError(404, "Question not found");

	const nextType = (payload.type as QuestionType | undefined) ?? question.type;
	const nextOptions =
		payload.options !== undefined ? payload.options : question.options;
	const nextCorrectAnswer =
		payload.correctAnswer !== undefined
			? payload.correctAnswer
			: question.correctAnswer;

	if (nextType === QuestionType.MCQ) {
		if (!Array.isArray(nextOptions) || nextOptions.length < 2) {
			throw new AppError(400, "MCQ questions require at least two options");
		}
		if (
			typeof nextCorrectAnswer !== "string" ||
			!nextOptions.includes(nextCorrectAnswer)
		) {
			throw new AppError(
				400,
				"MCQ correctAnswer must match one of the options",
			);
		}
	}

	const data: Prisma.QuestionUpdateInput = {};
	if (payload.prompt !== undefined) data.prompt = payload.prompt as string;
	if (payload.type !== undefined) data.type = payload.type as QuestionType;
	if (payload.points !== undefined) data.points = payload.points as number;
	if (payload.order !== undefined) data.order = payload.order as number;
	if ("options" in payload) {
		data.options =
			payload.options === null
				? Prisma.DbNull
				: (payload.options as Prisma.InputJsonValue);
	}
	if ("correctAnswer" in payload) {
		data.correctAnswer =
			payload.correctAnswer === null
				? Prisma.DbNull
				: (payload.correctAnswer as Prisma.InputJsonValue);
	}

	const result = await prisma.question.update({
		where: { id: questionId },
		data,
	});

	await clearAssessmentCache();
	await writeAuditLog(actor.id, "QUESTION_UPDATE", "Question", questionId, {
		assessmentId,
	});
	return result;
};

export const deleteQuestion = async (
	assessmentId: string,
	questionId: string,
	actor: Actor,
) => {
	await assertManager(assessmentId, actor);
	await assertNoAttempts(assessmentId);
	const question = await prisma.question.findFirst({
		where: { id: questionId, assessmentId, deletedAt: null },
	});
	if (!question) throw new AppError(404, "Question not found");

	await prisma.question.update({
		where: { id: questionId },
		data: { deletedAt: new Date() },
	});

	await clearAssessmentCache();
	await writeAuditLog(
		actor.id,
		"QUESTION_SOFT_DELETE",
		"Question",
		questionId,
		{
			assessmentId,
		},
	);
	return null;
};
