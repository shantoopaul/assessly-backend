export const getPagination = (pageValue: unknown, limitValue: unknown) => {
	const page = Math.max(1, Number(pageValue) || 1);
	const limit = Math.min(100, Math.max(1, Number(limitValue) || 10));
	return {
		page,
		limit,
		skip: (page - 1) * limit,
	};
};

export const buildMeta = (page: number, limit: number, total: number) => ({
	page,
	limit,
	total,
	totalPages: Math.ceil(total / limit),
});
