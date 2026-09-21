import Stripe from "stripe";
import { config } from "../config";
import { AppError } from "../utils/AppError";

let instance: Stripe | null = null;

export const getStripe = () => {
	if (!config.STRIPE_SECRET_KEY) {
		throw new AppError(503, "Stripe is not configured on this server");
	}
	if (!instance) {
		instance = new Stripe(config.STRIPE_SECRET_KEY);
	}
	return instance;
};
