import { catchAsync } from "../../utils/catchAsync";
import { getAuthenticatedUser } from "../../utils/getAuthenticatedUser";
import { getRouteParam } from "../../utils/getRouteParam";
import { sendResponse } from "../../utils/sendResponse";
import * as AttemptService from "./attempt.service";

export const enroll = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const assessmentId = getRouteParam(req.params.assessmentId, "assessmentId");
	const result = await AttemptService.enroll(user.id, assessmentId);
	sendResponse(res, 201, "Enrollment created successfully", result);
});

export const start = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const attemptId = getRouteParam(req.params.attemptId, "attemptId");
	const result = await AttemptService.start(user.id, attemptId);
	sendResponse(res, 200, "Assessment attempt started", result);
});

export const saveAnswer = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const attemptId = getRouteParam(req.params.attemptId, "attemptId");
	const questionId = getRouteParam(req.params.questionId, "questionId");
	const result = await AttemptService.saveAnswer(
		user.id,
		attemptId,
		questionId,
		req.body.response,
	);
	sendResponse(res, 200, "Answer saved successfully", result);
});

export const submit = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const attemptId = getRouteParam(req.params.attemptId, "attemptId");
	const result = await AttemptService.submit(user.id, attemptId);
	sendResponse(res, 200, "Attempt submitted successfully", result);
});

export const listMine = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const result = await AttemptService.listMine(user.id, req.query as never);
	sendResponse(
		res,
		200,
		"Attempts retrieved successfully",
		result.data,
		result.meta,
	);
});

export const getMine = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const attemptId = getRouteParam(req.params.attemptId, "attemptId");
	const result = await AttemptService.getCandidateAttempt(user.id, attemptId);
	sendResponse(res, 200, "Attempt retrieved successfully", result);
});
