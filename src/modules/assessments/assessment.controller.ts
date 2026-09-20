import { catchAsync } from "../../utils/catchAsync";
import { getAuthenticatedUser } from "../../utils/getAuthenticatedUser";
import { getRouteParam } from "../../utils/getRouteParam";
import { sendResponse } from "../../utils/sendResponse";
import * as AssessmentService from "./assessment.service";

export const create = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const result = await AssessmentService.create(user, req.body);
	sendResponse(res, 201, "Assessment created successfully", result);
});

export const list = catchAsync(async (req, res) => {
	const result = await AssessmentService.list(req.query as never);
	sendResponse(
		res,
		200,
		"Assessments retrieved successfully",
		result.data,
		result.meta,
	);
});

export const getById = catchAsync(async (req, res) => {
	const assessmentId = getRouteParam(req.params.id, "assessmentId");
	const result = await AssessmentService.getById(assessmentId);
	sendResponse(res, 200, "Assessment retrieved successfully", result);
});
