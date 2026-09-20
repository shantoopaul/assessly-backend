import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as AuthService from "./auth.service";

export const register = catchAsync(async (req, res) => {
	const result = await AuthService.register(req.body);
	sendResponse(res, 201, "Candidate registered successfully", result);
});

export const login = catchAsync(async (req, res) => {
	const result = await AuthService.login(req.body);
	sendResponse(res, 200, "Login successful", result);
});

export const googleLogin = catchAsync(async (req, res) => {
	const result = await AuthService.googleLogin(req.body.credential);
	sendResponse(res, 200, "Google login successful", result);
});

export const refresh = catchAsync(async (req, res) => {
	const result = await AuthService.refresh(req.body.refreshToken);
	sendResponse(res, 200, "Token refreshed successfully", result);
});

export const logout = catchAsync(async (req, res) => {
	await AuthService.logout(req.body.refreshToken);
	sendResponse(res, 200, "Logged out successfully", null);
});
