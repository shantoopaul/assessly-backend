import { Router } from "express";

import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as controller from "./assessment.controller";
import {
	createAssessmentSchema,
	idParamSchema,
	listAssessmentSchema,
	manageListSchema
} from "./assessment.validation";

export const assessmentRouter = Router();

assessmentRouter.post(
	"/",
	auth(Role.REVIEWER, Role.ADMIN),
	validateRequest(createAssessmentSchema),
	controller.create,
);

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

assessmentRouter.patch(
	"/:id/publish",
	auth(Role.REVIEWER, Role.ADMIN),
	validateRequest(idParamSchema),
	controller.publish,
);