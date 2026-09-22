import { catchAsync } from "../../utils/catchAsync";
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
