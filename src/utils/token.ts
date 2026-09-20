import jwt, { type SignOptions } from "jsonwebtoken";
import type { Role } from "../../generated/prisma/enums";
import { config } from "../config";

type AccessPayload = {
	sub: string;
	email: string;
	role: Role;
};

type RefreshPayload = {
	sub: string;
	tokenVersion: number;
	type: "refresh";
};

export const createAccessToken = (payload: AccessPayload) =>
	jwt.sign(payload, config.JWT_ACCESS_SECRET, {
		expiresIn: config.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
	});

export const createRefreshToken = (payload: RefreshPayload) =>
	jwt.sign(payload, config.JWT_REFRESH_SECRET, {
		expiresIn: config.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
	});

export const verifyAccessToken = (token: string) =>
	jwt.verify(token, config.JWT_ACCESS_SECRET) as jwt.JwtPayload & AccessPayload;

export const verifyRefreshToken = (token: string) =>
	jwt.verify(token, config.JWT_REFRESH_SECRET) as jwt.JwtPayload &
		RefreshPayload;
