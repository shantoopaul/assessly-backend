import { catchAsync } from "../../utils/catchAsync";
import { clearAuthCookies, setAuthCookies } from "../../utils/cookies";
import { sendResponse } from "../../utils/sendResponse";
import * as AuthService from "./auth.service";

export const register = catchAsync(async (req, res) => {
	const { user, accessToken, refreshToken } = await AuthService.register(
		req.body,
	);
	setAuthCookies(res, accessToken, refreshToken);
	sendResponse(res, 201, "Candidate registered successfully", { user });
});

export const login = catchAsync(async (req, res) => {
	const { user, accessToken, refreshToken } = await AuthService.login(req.body);
	setAuthCookies(res, accessToken, refreshToken);
	sendResponse(res, 200, "Login successful", { user });
});

export const googleLogin = catchAsync(async (req, res) => {
	const { user, accessToken, refreshToken } = await AuthService.googleLogin(
		req.body.credential,
	);
	setAuthCookies(res, accessToken, refreshToken);
	sendResponse(res, 200, "Google login successful", { user });
});

export const refresh = catchAsync(async (req, res) => {
	const refreshToken = req.cookies?.refreshToken;
	const tokens = await AuthService.refresh(refreshToken);
	setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
	sendResponse(res, 200, "Token refreshed successfully", null);
});

export const logout = catchAsync(async (req, res) => {
	const refreshToken = req.cookies?.refreshToken;
	if (refreshToken) {
		await AuthService.logout(refreshToken).catch(() => undefined);
	}
	clearAuthCookies(res);
	sendResponse(res, 200, "Logged out successfully", null);
});
