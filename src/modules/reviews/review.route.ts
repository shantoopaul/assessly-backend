import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as controller from "./review.controller";
import { attemptIdSchema, reviewListSchema } from "./review.validation";

export const reviewRouter = Router();

reviewRouter.use(auth(Role.REVIEWER));
reviewRouter.get("/queue", validateRequest(reviewListSchema), controller.queue);
reviewRouter.get("/mine", validateRequest(reviewListSchema), controller.mine);
reviewRouter.get(
	"/:attemptId",
	validateRequest(attemptIdSchema),
	controller.getAttempt,
);

reviewRouter.post(
	"/:attemptId/claim",
	validateRequest(attemptIdSchema),
	controller.claim,
);
