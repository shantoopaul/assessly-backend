import { OAuth2Client } from "google-auth-library";
import { config } from "../config";
import { AppError } from "../utils/AppError";

const client = new OAuth2Client(config.GOOGLE_CLIENT_ID || undefined);

export const verifyGoogleIdToken = async (credential: string) => {
	if (!config.GOOGLE_CLIENT_ID) {
		throw new AppError(
			503,
			"Google Sign-In is not configured on this server :/",
		);
	}

	const ticket = await client.verifyIdToken({
		idToken: credential,
		audience: config.GOOGLE_CLIENT_ID,
	});

	const payload = ticket.getPayload();
	if (!payload?.sub || !payload.email || !payload.email_verified) {
		throw new AppError(401, "Invalid or unverified Google account");
	}

	return {
		googleId: payload.sub,
		email: payload.email.toLowerCase(),
		name: payload.name || payload.email.split("@")[0],
		avatarUrl: payload.picture,
	};
};
