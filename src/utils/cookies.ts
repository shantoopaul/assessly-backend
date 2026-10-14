import type { CookieOptions, Response } from "express";
import { config } from "../config";

const isProd = config.NODE_ENV === "production";

const accessCookieOptions: CookieOptions = {
	httpOnly: true,
	secure: isProd,
	sameSite: isProd ? "none" : "lax",
	path: "/",
};

const refreshCookieOptions: CookieOptions = {
	httpOnly: true,
	secure: isProd,
	sameSite: isProd ? "none" : "lax",
	path: "/",
};

export const setAuthCookies = (
	res: Response,
	accessToken: string,
	refreshToken: string,
) => {
	res.cookie("accessToken", accessToken, {
		...accessCookieOptions,
		maxAge: 15 * 60 * 1000,
	});
	res.cookie("refreshToken", refreshToken, {
		...refreshCookieOptions,
		maxAge: 7 * 24 * 60 * 60 * 1000,
	});
};

export const clearAuthCookies = (res: Response) => {
	res.clearCookie("accessToken", {
		...accessCookieOptions,
		maxAge: 0,
		expires: new Date(0),
	});
	res.clearCookie("refreshToken", {
		...refreshCookieOptions,
		maxAge: 0,
		expires: new Date(0),
	});
};
