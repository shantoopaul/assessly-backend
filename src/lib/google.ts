import { OAuth2Client } from "google-auth-library";
import { config } from "../config";

if (!config.GOOGLE_CLIENT_ID) {
	console.warn(
		"GOOGLE_CLIENT_ID is not set — Google login will return 503 until configured.",
	);
}

export const googleClient = new OAuth2Client({
	client_id: config.GOOGLE_CLIENT_ID || undefined,
});

export const isGoogleConfigured = () => Boolean(config.GOOGLE_CLIENT_ID);
