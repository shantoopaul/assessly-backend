import { app } from "./app";
import { config } from "./config";
import { prisma } from "./lib/prisma";
import { connectRedis, redisClient } from "./lib/redis";

const start = async () => {
  try {
    await prisma.$connect();
    console.log("PostgreSQL connected.");

    await connectRedis();

    const server = app.listen(config.PORT, () => {
      console.log(`Assessly Backend API running on port ${config.PORT}`);
    });

    const shutdown = async (signal: string) => {
      console.log(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        if (redisClient?.isOpen) await redisClient.quit().catch(() => undefined);
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start server:", error);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  }
};

void start();