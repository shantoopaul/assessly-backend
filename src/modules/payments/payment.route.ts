import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as controller from "./payment.controller";
import {
	attemptPaymentSchema,
	confirmPaymentSchema,
	initiatePaymentSchema,
	paymentIdSchema,
} from "./payment.validation";

export const paymentRouter = Router();

paymentRouter.post(
	"/attempts/:attemptId/initiate",
	auth(Role.CANDIDATE),
	validateRequest(initiatePaymentSchema),
	controller.initiate,
);

paymentRouter.post(
	"/:paymentId/confirm",
	auth(Role.CANDIDATE),
	validateRequest(confirmPaymentSchema),
	controller.confirm,
);

paymentRouter.get(
	"/attempts/:attemptId",
	auth(Role.CANDIDATE),
	validateRequest(attemptPaymentSchema),
	controller.getByAttempt,
);

paymentRouter.get(
	"/:paymentId",
	auth(Role.CANDIDATE, Role.ADMIN),
	validateRequest(paymentIdSchema),
	controller.getById,
);
