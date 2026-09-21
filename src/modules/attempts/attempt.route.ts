import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as controller from "./attempt.controller";
import {
	answerSchema,
	assessmentIdSchema,
	attemptIdSchema,
} from "./attempt.validation";

export const attemptRouter = Router();
attemptRouter.use(auth(Role.CANDIDATE));

attemptRouter.post(
	"/enroll/:assessmentId",
	validateRequest(assessmentIdSchema),
	controller.enroll,
);

attemptRouter.post(
	"/:attemptId/start",
	validateRequest(attemptIdSchema),
	controller.start,
);

attemptRouter.put(
	"/:attemptId/answers/:questionId",
	validateRequest(answerSchema),
	controller.saveAnswer,
);
