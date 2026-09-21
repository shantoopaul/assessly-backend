import { Router } from "express";

import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as controller from "./assessment.controller";
import {
	createAssessmentSchema,
	createQuestionSchema,
	idParamSchema,
	listAssessmentSchema,
	manageListSchema,
	questionParamSchema,
	updateAssessmentSchema,
	updateQuestionSchema,
} from "./assessment.validation";

export const assessmentRouter = Router();

assessmentRouter.get(
	"/",
	validateRequest(listAssessmentSchema),
	controller.list,
);

assessmentRouter.get(
	"/:id",
	validateRequest(idParamSchema),
	controller.getById,
);

assessmentRouter.get(
	"/manage/mine",
	auth(Role.REVIEWER, Role.ADMIN),
	validateRequest(manageListSchema),
	controller.listManaged,
);

assessmentRouter.get(
	"/manage/:id",
	auth(Role.REVIEWER, Role.ADMIN),
	validateRequest(idParamSchema),
	controller.getManaged,
);

assessmentRouter.post(
	"/",
	auth(Role.REVIEWER, Role.ADMIN),
	validateRequest(createAssessmentSchema),
	controller.create,
);

assessmentRouter.patch(
	"/:id",
	auth(Role.REVIEWER, Role.ADMIN),
	validateRequest(updateAssessmentSchema),
	controller.update,
);

assessmentRouter.patch(
	"/:id/publish",
	auth(Role.REVIEWER, Role.ADMIN),
	validateRequest(idParamSchema),
	controller.publish,
);

assessmentRouter.delete(
	"/:id",
	auth(Role.REVIEWER, Role.ADMIN),
	validateRequest(idParamSchema),
	controller.softDelete,
);

assessmentRouter.post(
	"/:id/questions",
	auth(Role.REVIEWER, Role.ADMIN),
	validateRequest(createQuestionSchema),
	controller.addQuestion,
);

assessmentRouter.patch(
	"/:id/questions/:questionId",
	auth(Role.REVIEWER, Role.ADMIN),
	validateRequest(updateQuestionSchema),
	controller.updateQuestion,
);

assessmentRouter.delete(
	"/:id/questions/:questionId",
	auth(Role.REVIEWER, Role.ADMIN),
	validateRequest(questionParamSchema),
	controller.deleteQuestion,
);
