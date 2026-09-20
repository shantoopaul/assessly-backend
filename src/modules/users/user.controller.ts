import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as UserService from "./user.service";

export const getMe = catchAsync(async (req, res) => {
  const result = await UserService.getMe(req.user!.id);
  sendResponse(res, 200, "Profile retrieved successfully", result);
});

export const updateMe = catchAsync(async (req, res) => {
  const result = await UserService.updateMe(req.user!.id, req.body);
  sendResponse(res, 200, "Profile updated successfully", result);
});

export const uploadAvatar = catchAsync(async (req, res) => {
  const result = await UserService.uploadAvatar(req.user!.id, req.file);
  sendResponse(res, 200, "Profile image updated successfully", result);
});