import { catchAsync } from "../../utils/catchAsync";
import { getAuthenticatedUser } from "../../utils/getAuthenticatedUser";
import { getRouteParam } from "../../utils/getRouteParam";
import { sendResponse } from "../../utils/sendResponse";
import * as AdminService from "./admin.service";

export const listUsers = catchAsync(async (req, res) => {
	const result = await AdminService.listUsers(req.query as never);
	sendResponse(
		res,
		200,
		"Users retrieved successfully",
		result.data,
		result.meta,
	);
});

export const updateStatus = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const userId = getRouteParam(req.params.userId, "userId");
	const result = await AdminService.updateUserStatus(
		user.id,
		userId,
		req.body.status,
	);
	sendResponse(res, 200, "User status updated successfully", result);
});

export const updateRole = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const userId = getRouteParam(req.params.userId, "userId");
	const result = await AdminService.updateUserRole(
		user.id,
		userId,
		req.body.role,
	);
	sendResponse(res, 200, "User role updated successfully", result);
});

export const softDeleteUser = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const userId = getRouteParam(req.params.userId, "userId");
	await AdminService.softDeleteUser(user.id, userId);
	sendResponse(res, 200, "User deleted successfully", null);
});
