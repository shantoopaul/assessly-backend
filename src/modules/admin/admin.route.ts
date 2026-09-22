import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as controller from "./admin.controller";
import {
	listUsersSchema,
	updateRoleSchema,
	updateStatusSchema,
} from "./admin.validation";

export const adminRouter = Router();
adminRouter.use(auth(Role.ADMIN));

adminRouter.get(
	"/users",
	validateRequest(listUsersSchema),
	controller.listUsers,
);

adminRouter.patch(
	"/users/:userId/status",
	validateRequest(updateStatusSchema),
	controller.updateStatus,
);

adminRouter.patch(
	"/users/:userId/role",
	validateRequest(updateRoleSchema),
	controller.updateRole,
);
