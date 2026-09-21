import { catchAsync } from "../../utils/catchAsync";
import { getAuthenticatedUser } from "../../utils/getAuthenticatedUser";
import { getRouteParam } from "../../utils/getRouteParam";
import { sendResponse } from "../../utils/sendResponse";
import * as PaymentService from "./payment.service";

export const initiate = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const attemptId = getRouteParam(req.params.attemptId, "attemptId");
	const result = await PaymentService.initiate(
		user.id,
		attemptId,
		req.body.paymentMethodId,
	);
	sendResponse(res, 201, "Payment initiated successfully", result);
});

export const confirm = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const paymentId = getRouteParam(req.params.paymentId, "paymentId");
	const result = await PaymentService.confirm(
		user.id,
		paymentId,
		req.body.paymentMethodId,
	);
	sendResponse(res, 200, "Payment confirmation processed", result);
});
