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

export const listManaged = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const result = await AssessmentService.listManaged(user, req.query as never);
	sendResponse(
		res,
		200,
		"Managed assessments retrieved successfully",
		result.data,
		result.meta,
	);
});

export const getManaged = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const assessmentId = getRouteParam(req.params.id, "assessmentId");
	const result = await AssessmentService.getManaged(assessmentId, user);
	sendResponse(res, 200, "Managed assessment retrieved successfully", result);
});

export const publish = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const assessmentId = getRouteParam(req.params.id, "assessmentId");
	const result = await AssessmentService.publish(assessmentId, user);
	sendResponse(res, 200, "Assessment published successfully", result);
});

export const update = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const assessmentId = getRouteParam(req.params.id, "assessmentId");
	const result = await AssessmentService.update(assessmentId, user, req.body);
	sendResponse(res, 200, "Assessment updated successfully", result);
});

export const softDelete = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const assessmentId = getRouteParam(req.params.id, "assessmentId");
	await AssessmentService.softDelete(assessmentId, user);
	sendResponse(res, 200, "Assessment deleted successfully", null);
});

export const addQuestion = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const assessmentId = getRouteParam(req.params.id, "assessmentId");
	const result = await AssessmentService.addQuestion(
		assessmentId,
		user,
		req.body,
	);
	sendResponse(res, 201, "Question added successfully", result);
});

export const updateQuestion = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const assessmentId = getRouteParam(req.params.id, "assessmentId");
	const questionId = getRouteParam(req.params.questionId, "questionId");
	const result = await AssessmentService.updateQuestion(
		assessmentId,
		questionId,
		user,
		req.body,
	);
	sendResponse(res, 200, "Question updated successfully", result);
});

export const deleteQuestion = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const assessmentId = getRouteParam(req.params.id, "assessmentId");
	const questionId = getRouteParam(req.params.questionId, "questionId");
	await AssessmentService.deleteQuestion(assessmentId, questionId, user);
	sendResponse(res, 200, "Question deleted successfully", null);
});
