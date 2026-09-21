import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as controller from "./payment.controller";
import {
	confirmPaymentSchema,
	initiatePaymentSchema,
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
