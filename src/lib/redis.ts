import { createClient } from "redis";
import { config } from "../config";

export const redisClient = config.REDIS_URL
	? createClient({ url: config.REDIS_URL })
	: null;

if (redisClient) {
	redisClient.on("error", (error) => {
		console.warn("Redis error:", error.message);
	});
}

export const connectRedis = async () => {
	if (!redisClient || redisClient.isOpen) return;
	try {
		await redisClient.connect();
		console.log("Redis connected.");
	} catch {
		console.warn("Redis unavailable :/");
	}
};
