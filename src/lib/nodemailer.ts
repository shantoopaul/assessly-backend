import nodemailer from "nodemailer";
import { config } from "../config";

const transporter =
	config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASSWORD
		? nodemailer.createTransport({
				host: config.SMTP_HOST,
				port: config.SMTP_PORT,
				secure: config.SMTP_SECURE,
				auth: {
					user: config.SMTP_USER,
					pass: config.SMTP_PASSWORD,
				},
			})
		: null;

export const sendEmail = async (to: string, subject: string, text: string) => {
	if (!transporter) {
		if (config.NODE_ENV === "development") {
			console.log(`[email skipped] to=${to} subject=${subject}`);
		}
		return;
	}

	await transporter.sendMail({
		from: config.EMAIL_SENDER,
		to,
		subject,
		text,
	});
};
