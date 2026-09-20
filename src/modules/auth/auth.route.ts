import { Router } from "express";
import { authLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import * as controller from "./auth.controller";
import {
	googleSchema,
	loginSchema,
	logoutSchema,
	refreshSchema,
	registerSchema,
} from "./auth.validation";

export const authRouter = Router();

authRouter.post(
	"/register",
	authLimiter,
	validateRequest(registerSchema),
	controller.register,
);
authRouter.post(
	"/login",
	authLimiter,
	validateRequest(loginSchema),
	controller.login,
);
authRouter.post(
	"/google",
	authLimiter,
	validateRequest(googleSchema),
	controller.googleLogin,
);
authRouter.post(
	"/refresh-token",
	authLimiter,
	validateRequest(refreshSchema),
	controller.refresh,
);
authRouter.post("/logout", validateRequest(logoutSchema), controller.logout);
