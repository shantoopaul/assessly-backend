import type Stripe from "stripe";
import { AttemptStatus, PaymentStatus } from "../../../generated/prisma/enums";
import { config } from "../../config";
import { prisma } from "../../lib/prisma";
import { getStripe } from "../../lib/stripe";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";

const mapStripeStatus = (intent: Stripe.PaymentIntent): PaymentStatus => {
	const status = intent.status;
	if (status === "succeeded") return PaymentStatus.SUCCEEDED;
	if (intent.last_payment_error) return PaymentStatus.FAILED;
	if (status === "canceled") return PaymentStatus.CANCELLED;
	if (
		status === "requires_action" ||
		status === "requires_confirmation" ||
		status === "requires_payment_method"
	) {
		return status === "requires_payment_method"
			? PaymentStatus.PENDING
			: PaymentStatus.REQUIRES_ACTION;
	}
	return PaymentStatus.PENDING;
};

const syncPaymentIntent = async (intent: Stripe.PaymentIntent) => {
	const payment = await prisma.payment.findUnique({
		where: { stripePaymentIntentId: intent.id },
	});
	if (!payment) return null;

	const status = mapStripeStatus(intent);
	return prisma.$transaction(async (tx) => {
		const updated = await tx.payment.update({
			where: { id: payment.id },
			data: {
				status,
				failureReason:
					intent.last_payment_error?.message ??
					(status === PaymentStatus.FAILED ? "Payment failed" : null),
			},
		});

		if (status === PaymentStatus.SUCCEEDED) {
			await tx.attempt.updateMany({
				where: { id: payment.attemptId, status: AttemptStatus.PENDING_PAYMENT },
				data: { status: AttemptStatus.READY },
			});
		}
		return updated;
	});
};

export const initiate = async (
	candidateId: string,
	attemptId: string,
	paymentMethodId?: string,
) => {
	const stripe = getStripe();
	const attempt = await prisma.attempt.findFirst({
		where: { id: attemptId, candidateId, deletedAt: null },
		include: { assessment: true, payment: true },
	});

	if (!attempt) throw new AppError(404, "Attempt not found");
	if (attempt.assessment.feeCents <= 0)
		throw new AppError(409, "This assessment does not require payment");
	if (
		attempt.status !== AttemptStatus.PENDING_PAYMENT &&
		attempt.status !== AttemptStatus.READY
	) {
		throw new AppError(409, "Payment cannot be initiated for this attempt");
	}
	if (attempt.payment?.status === PaymentStatus.SUCCEEDED) {
		return {
			payment: attempt.payment,
			clientSecret: null,
			stripeStatus: "succeeded",
		};
	}

	const payment =
		attempt.payment ??
		(await prisma.payment.upsert({
			where: { attemptId },
			update: {},
			create: {
				attemptId,
				userId: candidateId,
				amountCents: attempt.assessment.feeCents,
				currency: attempt.assessment.currency,
				status: PaymentStatus.PENDING,
			},
		}));

	let intent: Stripe.PaymentIntent;
	if (payment.stripePaymentIntentId) {
		intent = await stripe.paymentIntents.retrieve(
			payment.stripePaymentIntentId,
		);
		if (paymentMethodId && intent.status === "requires_payment_method") {
			intent = await stripe.paymentIntents.confirm(intent.id, {
				payment_method: paymentMethodId,
				return_url: config.STRIPE_RETURN_URL,
			});
		}
	} else {
		intent = await stripe.paymentIntents.create(
			{
				amount: payment.amountCents,
				currency: payment.currency,
				payment_method_types: ["card"],
				...(paymentMethodId
					? {
							payment_method: paymentMethodId,
							confirm: true,
							return_url: config.STRIPE_RETURN_URL,
						}
					: {}),
				metadata: { paymentId: payment.id, attemptId, candidateId },
			},
			{ idempotencyKey: `attempt-payment-${attemptId}` },
		);

		await prisma.payment.update({
			where: { id: payment.id },
			data: { stripePaymentIntentId: intent.id },
		});
	}

	const synced = await syncPaymentIntent(intent);
	await writeAuditLog(candidateId, "PAYMENT_INITIATE", "Payment", payment.id, {
		attemptId,
		stripePaymentIntentId: intent.id,
	});
	return {
		payment: synced,
		clientSecret: intent.client_secret,
		stripeStatus: intent.status,
	};
};

export const confirm = async (
	candidateId: string,
	paymentId: string,
	paymentMethodId: string,
) => {
	const stripe = getStripe();
	const payment = await prisma.payment.findFirst({
		where: { id: paymentId, userId: candidateId },
	});
	if (!payment) throw new AppError(404, "Payment not found");
	if (!payment.stripePaymentIntentId)
		throw new AppError(409, "Stripe PaymentIntent has not been created");
	if (payment.status === PaymentStatus.SUCCEEDED) return payment;

	const intent = await stripe.paymentIntents.confirm(
		payment.stripePaymentIntentId,
		{
			payment_method: paymentMethodId,
			return_url: config.STRIPE_RETURN_URL,
		},
	);
	const synced = await syncPaymentIntent(intent);
	await writeAuditLog(candidateId, "PAYMENT_CONFIRM", "Payment", payment.id);
	return {
		payment: synced,
		stripeStatus: intent.status,
		clientSecret: intent.client_secret,
	};
};
