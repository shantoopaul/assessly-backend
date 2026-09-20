import { AppError } from "./AppError";

export const getRouteParam = (
	value: string | string[] | undefined,
	name = "parameter",
): string => {
	const param = Array.isArray(value) ? value[0] : value;

	if (!param) {
		throw new AppError(400, `${name} is required`);
	}

	return param;
};
