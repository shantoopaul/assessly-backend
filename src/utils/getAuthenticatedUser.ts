import type { Request } from "express";
import { AppError } from "./AppError";

type AuthenticatedUser = NonNullable<Request["user"]>;

export const getAuthenticatedUser = (
	user: Request["user"],
): AuthenticatedUser => {
	if (!user) {
		throw new AppError(401, "Authentication is required");
	}

	return user;
};
