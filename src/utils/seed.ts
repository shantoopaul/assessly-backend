import bcrypt from "bcryptjs";
import { Role } from "../../generated/prisma/enums";
import { config } from "../config";
import { prisma } from "../lib/prisma";

const seedUser = async (
	name: string,
	email: string,
	password: string,
	role: Role,
) => {
	const existing = await prisma.user.findUnique({ where: { email } });
	const hashed = await bcrypt.hash(password, config.BCRYPT_SALT_ROUNDS);

	if (existing) {
		await prisma.user.update({
			where: { id: existing.id },
			data: {
				name,
				password: hashed,
				role,
				status: "ACTIVE",
				deletedAt: null,
			},
		});
		return;
	}

	await prisma.user.create({
		data: {
			name,
			email,
			password: hashed,
			role,
		},
	});
};

export const seedTestUsers = async () => {
	await seedUser(
		config.TESTER_ADMIN_NAME,
		config.TESTER_ADMIN_EMAIL,
		config.TESTER_ADMIN_PASSWORD,
		Role.ADMIN,
	);
	await seedUser(
		config.TESTER_REVIEWER_NAME,
		config.TESTER_REVIEWER_EMAIL,
		config.TESTER_REVIEWER_PASSWORD,
		Role.REVIEWER,
	);
	await seedUser(
		config.TESTER_CANDIDATE_NAME,
		config.TESTER_CANDIDATE_EMAIL,
		config.TESTER_CANDIDATE_PASSWORD,
		Role.CANDIDATE,
	);
	console.log("Test users are ready for use.");
};
