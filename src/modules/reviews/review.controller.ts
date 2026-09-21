import { catchAsync } from "../../utils/catchAsync";
import { getAuthenticatedUser } from "../../utils/getAuthenticatedUser";
import { getRouteParam } from "../../utils/getRouteParam";
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

export const getAttempt = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const attemptId = getRouteParam(req.params.attemptId, "attemptId");
	const result = await ReviewService.getReviewAttempt(user.id, attemptId);
	sendResponse(res, 200, "Review attempt retrieved successfully", result);
});

export const claim = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const attemptId = getRouteParam(req.params.attemptId, "attemptId");
	const result = await ReviewService.claim(user.id, attemptId);
	sendResponse(res, 200, "Attempt claimed successfully", result);
});

export const evaluate = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const attemptId = getRouteParam(req.params.attemptId, "attemptId");
	const result = await ReviewService.evaluate(user.id, attemptId, req.body);
	sendResponse(res, 200, "Attempt evaluated successfully", result);
});
