import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import { notFound } from "./middleware/notFound";
import { apiLimiter } from "./middleware/rateLimiter";
import { apiRouter } from "./routes";

export const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin:
      config.FRONTEND_URL === "*"
        ? true
        : config.FRONTEND_URL.split(",").map((origin) => origin.trim()),
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
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