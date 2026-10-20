import bcrypt from "bcryptjs";
import type { TokenPayload } from "google-auth-library";
import {
	AuthProvider,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";
import { config } from "../../config";
import { googleClient } from "../../lib/google";
import { sendEmail } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";
import {
	createAccessToken,
	createRefreshToken,
	verifyRefreshToken,
} from "../../utils/token";

const publicUserSelect = {
	id: true,
	name: true,
	email: true,
	role: true,
	status: true,
	avatarUrl: true,
	createdAt: true,
} as const;

const createSession = (user: {
	id: string;
	email: string;
	role: Role;
	tokenVersion: number;
}) => ({
	accessToken: createAccessToken({
		sub: user.id,
		email: user.email,
		role: user.role,
		tokenVersion: user.tokenVersion,
	}),
	refreshToken: createRefreshToken({
		sub: user.id,
		tokenVersion: user.tokenVersion,
		type: "refresh",
	}),
});

export const register = async (payload: {
	name: string;
	email: string;
	password: string;
}) => {
	const existing = await prisma.user.findUnique({
		where: { email: payload.email },
	});
	if (existing) {
		throw new AppError(409, "An account with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(
		payload.password,
		config.BCRYPT_SALT_ROUNDS,
	);

	const user = await prisma.user.create({
		data: {
			name: payload.name,
			email: payload.email,
			password: hashedPassword,
			role: Role.CANDIDATE,
		},
		select: {
			...publicUserSelect,
			tokenVersion: true,
		},
	});

	await writeAuditLog(user.id, "AUTH_REGISTER", "User", user.id);
	void sendEmail(
		user.email,
		"Welcome to Assessly",
		`Hello there ${user.name}, your candidate account is ready :)`,
	).catch((err) => {
		console.error("[welcome email failed]", err);
	});

	const { tokenVersion, ...safeUser } = user;
	return {
		user: safeUser,
		...createSession({ ...safeUser, tokenVersion }),
	};
};

export const login = async (payload: { email: string; password: string }) => {
	const user = await prisma.user.findFirst({
		where: {
			email: payload.email,
			deletedAt: null,
		},
	});

	if (!user?.password) {
		throw new AppError(401, "Invalid email or password");
	}
	if (user.status !== UserStatus.ACTIVE) {
		throw new AppError(403, "This account is blocked");
	}

	const matched = await bcrypt.compare(payload.password, user.password);
	if (!matched) {
		throw new AppError(401, "Invalid email or password");
	}

	await writeAuditLog(user.id, "AUTH_LOGIN", "User", user.id);

	const safeUser = await prisma.user.findUniqueOrThrow({
		where: { id: user.id },
		select: publicUserSelect,
	});

	return {
		user: safeUser,
		...createSession(user),
	};
};

export const googleLogin = async (credential: string) => {
	if (!config.GOOGLE_CLIENT_ID) {
		throw new AppError(503, "Google login is not configured on this server");
	}

	let googleIdTokenPayload: TokenPayload | null | undefined = null;

	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: credential,
			audience: config.GOOGLE_CLIENT_ID,
		});

		googleIdTokenPayload = ticket.getPayload();
	} catch (error) {
		console.log("Google ID Token Verification Failed", error);
		throw new AppError(401, "Invalid Or Expired Google Id Token");
	}

	if (!googleIdTokenPayload) {
		throw new AppError(401, "Invalid Or Expired Google Id Token");
	}
	if (!googleIdTokenPayload.email) {
		throw new AppError(400, "Google Email Not Found");
	}
	if (!googleIdTokenPayload.name) {
		throw new AppError(400, "Google Email User Name Not Found");
	}

	let user = await prisma.user.findFirst({
		where: {
			email: googleIdTokenPayload.email,
			googleId: googleIdTokenPayload.sub,
			deletedAt: null,
		},
	});

	if (!user) {
		const existingCredentialUser = await prisma.user.findFirst({
			where: {
				email: googleIdTokenPayload.email,
				authProvider: AuthProvider.CREDENTIALS,
				deletedAt: null,
			},
		});

		if (existingCredentialUser) {
			if (existingCredentialUser.status === UserStatus.BLOCKED) {
				throw new AppError(403, "User is Blocked");
			}

			user = await prisma.user.update({
				where: { id: existingCredentialUser.id },
				data: { googleId: googleIdTokenPayload.sub },
			});
		} else {
			user = await prisma.user.create({
				data: {
					name: googleIdTokenPayload.name,
					email: googleIdTokenPayload.email,
					googleId: googleIdTokenPayload.sub,
					authProvider: AuthProvider.GOOGLE,
					avatarUrl: googleIdTokenPayload.picture ?? null,
				},
			});
		}
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(403, "User Is Blocked");
	}

	await writeAuditLog(user.id, "AUTH_GOOGLE_LOGIN", "User", user.id);

	const safeUser = await prisma.user.findUniqueOrThrow({
		where: { id: user.id },
		select: publicUserSelect,
	});

	return {
		user: safeUser,
		...createSession(user),
	};
};
export const refresh = async (token: string | undefined) => {
	if (!token) throw new AppError(401, "Refresh token is missing");
	let payload;
	try {
		payload = verifyRefreshToken(token);
	} catch {
		throw new AppError(401, "Invalid or expired refresh token");
	}

	if (payload.type !== "refresh") {
		throw new AppError(401, "Invalid refresh token");
	}

	const user = await prisma.user.findFirst({
		where: {
			id: payload.sub,
			deletedAt: null,
			status: UserStatus.ACTIVE,
		},
	});

	if (!user || user.tokenVersion !== payload.tokenVersion) {
		throw new AppError(401, "Refresh token has been revoked");
	}

	return createSession(user);
};

export const logout = async (token: string | undefined) => {
	if (!token) return null;
	let payload;
	try {
		payload = verifyRefreshToken(token);
	} catch {
		throw new AppError(401, "Invalid refresh token");
	}

	await prisma.user.update({
		where: { id: payload.sub },
		data: { tokenVersion: { increment: 1 } },
	});

	await writeAuditLog(payload.sub, "AUTH_LOGOUT", "User", payload.sub);
	return null;
};
