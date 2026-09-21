import { catchAsync } from "../../utils/catchAsync";
import { getAuthenticatedUser } from "../../utils/getAuthenticatedUser";
import { sendResponse } from "../../utils/sendResponse";
import * as ReviewService from "./review.service";

export const queue = catchAsync(async (req, res) => {
	const result = await ReviewService.queue(req.query as never);
	sendResponse(
		res,
		200,
		"Review queue retrieved successfully",
		result.data,
		result.meta,
	);
});

export const mine = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const result = await ReviewService.mine(user.id, req.query as never);
	sendResponse(
		res,
		200,
		"Assigned reviews retrieved successfully",
		result.data,
		result.meta,
	);
});
