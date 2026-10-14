import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import type { Role } from "../../generated/prisma/enums";
import { config } from "../config";

type ExpiresIn = SignOptions["expiresIn"];

export type AccessTokenPayload = JwtPayload & {
	sub: string;
	email: string;
	role: Role;
	tokenVersion: number;
};

export type RefreshTokenPayload = JwtPayload & {
	sub: string;
	tokenVersion: number;
	type: "refresh";
};

const createToken = (
	payload: JwtPayload,
	secret: string,
	expiresIn: ExpiresIn,
) => {
	return jwt.sign(payload, secret, { expiresIn });
};

export const createAccessToken = (payload: {
	sub: string;
	email: string;
	role: Role;
	tokenVersion: number;
}) =>
	createToken(
		payload,
		config.JWT_ACCESS_SECRET,
		config.JWT_ACCESS_EXPIRES_IN as ExpiresIn,
	);

export const createRefreshToken = (payload: {
	sub: string;
	tokenVersion: number;
	type: "refresh";
}) => {
	return createToken(
		payload,
		config.JWT_REFRESH_SECRET,
		config.JWT_REFRESH_EXPIRES_IN as ExpiresIn,
	);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
	return jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
	const payload = jwt.verify(
		token,
		config.JWT_REFRESH_SECRET,
	) as RefreshTokenPayload;

	if (payload.type !== "refresh") {
		throw new Error("Invalid refresh token");
	}

	return payload;
};

export const tokens = {
	createToken,
	verifyToken: (token: string, secret: string) => {
		try {
			return {
				success: true,
				data: jwt.verify(token, secret),
			};
		} catch (error) {
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "Token verification failed",
			};
		}
	},
};
