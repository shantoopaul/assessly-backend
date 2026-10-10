import type { RequestHandler } from "express";
import { type Role, UserStatus } from "../../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { verifyAccessToken } from "../utils/token";

export const auth = (...roles: Role[]): RequestHandler => {
	return async (req, _res, next) => {
		try {
			const bearer = req.headers.authorization?.startsWith("Bearer ")
				? req.headers.authorization.slice(7)
				: undefined;
			const token = req.cookies?.accessToken ?? bearer;

			if (!token) {
				throw new AppError(401, "Authentication token is required");
			}

			const payload = verifyAccessToken(token);

			const user = await prisma.user.findFirst({
				where: {
					id: payload.sub,
					deletedAt: null,
					status: UserStatus.ACTIVE,
				},
				select: { id: true, email: true, role: true },
			});

			if (!user) throw new AppError(401, "User account is unavailable");

			if (roles.length > 0 && !roles.includes(user.role)) {
				throw new AppError(403, "You are not allowed to access this resource");
			}

			req.user = user;
			next();
		} catch (error) {
			if (error instanceof AppError) {
				next(error);
				return;
			}
			next(new AppError(401, "Invalid or expired access token"));
		}
	};
};
