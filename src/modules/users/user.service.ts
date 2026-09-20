import { uploadImageBuffer } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";

const profileSelect = {
	id: true,
	name: true,
	email: true,
	role: true,
	status: true,
	avatarUrl: true,
	createdAt: true,
	updatedAt: true,
} as const;

export const getMe = async (userId: string) => {
	const user = await prisma.user.findFirst({
		where: { id: userId, deletedAt: null },
		select: profileSelect,
	});
	if (!user) throw new AppError(404, "User not found");
	return user;
};

export const updateMe = async (userId: string, payload: { name?: string }) => {
	const user = await prisma.user.update({
		where: { id: userId },
		data: payload,
		select: profileSelect,
	});
	await writeAuditLog(userId, "PROFILE_UPDATE", "User", userId);
	return user;
};

export const uploadAvatar = async (
	userId: string,
	file?: Express.Multer.File,
) => {
	if (!file) throw new AppError(400, "profileImage file is required");

	const avatarUrl = await uploadImageBuffer(file.buffer);
	const user = await prisma.user.update({
		where: { id: userId },
		data: { avatarUrl },
		select: profileSelect,
	});

	await writeAuditLog(userId, "PROFILE_AVATAR_UPDATE", "User", userId);
	return user;
};
