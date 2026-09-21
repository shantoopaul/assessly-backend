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