import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import { notFound } from "./middleware/notFound";
import { apiLimiter } from "./middleware/rateLimiter";
import { webhook as stripeWebhook } from "./modules/payments/payment.controller";
import { apiRouter } from "./routes";

const app = express();

app.use(helmet());
app.use(
	cors({
		origin: config.FRONTEND_URL,
		credentials: true,
	}),
);
app.post(
	"/api/v1/payments/webhook",
	express.raw({ type: "application/json" }),
	stripeWebhook,
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/api", apiLimiter);

app.get("/", (_req, res) => {
	res.status(200).json({
		success: true,
		message: "Assessly Backend API",
		data: {
			version: "v1",
		},
	});
});

app.get("/health", (_req, res) => {
	res.status(200).json({
		success: true,
		message: "API is healthy",
		data: { uptime: process.uptime() },
	});
});

app.use("/api/v1", apiRouter);
app.use(notFound);
app.use(globalErrorHandler);

export default app;
