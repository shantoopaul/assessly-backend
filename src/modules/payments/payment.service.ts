import type Stripe from "stripe";
import {
	AttemptStatus,
	PaymentStatus,
	Role,
} from "../../../generated/prisma/enums";
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
				where: {
					id: payment.attemptId,
					status: AttemptStatus.PENDING_PAYMENT,
				},
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
		where: {
			id: attemptId,
			candidateId,
			deletedAt: null,
		},
		include: {
			assessment: true,
			payment: true,
		},
	});

	if (!attempt) throw new AppError(404, "Attempt not found");
	if (attempt.assessment.feeCents <= 0) {
		throw new AppError(409, "This assessment does not require payment");
	}
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
				metadata: {
					paymentId: payment.id,
					attemptId,
					candidateId,
				},
			},
			{
				idempotencyKey: `attempt-payment-${attemptId}`,
			},
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
		where: {
			id: paymentId,
			userId: candidateId,
		},
	});
	if (!payment) throw new AppError(404, "Payment not found");
	if (!payment.stripePaymentIntentId) {
		throw new AppError(409, "Stripe PaymentIntent has not been created");
	}
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

export const getById = async (
	actor: { id: string; role: Role },
	paymentId: string,
) => {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		include: {
			attempt: {
				select: {
					id: true,
					candidateId: true,
					assessment: {
						select: {
							id: true,
							title: true,
						},
					},
				},
			},
		},
	});

	if (!payment) throw new AppError(404, "Payment not found");
	if (actor.role !== Role.ADMIN && payment.userId !== actor.id) {
		throw new AppError(403, "You cannot access this payment");
	}
	return payment;
};

export const getByAttempt = async (candidateId: string, attemptId: string) => {
	const payment = await prisma.payment.findFirst({
		where: {
			attemptId,
			userId: candidateId,
		},
	});
	if (!payment) throw new AppError(404, "Payment not found");
	return payment;
};

const markCheckoutPaid = async (session: Stripe.Checkout.Session) => {
	const paymentId = session.metadata?.paymentId;
	const attemptId = session.metadata?.attemptId;

	if (!paymentId || !attemptId) {
		return;
	}

	if (session.payment_status !== "paid") {
		return;
	}

	const paymentIntentId =
		typeof session.payment_intent === "string"
			? session.payment_intent
			: (session.payment_intent?.id ?? null);

	await prisma.$transaction(async (tx) => {
		await tx.payment.updateMany({
			where: {
				id: paymentId,
				status: {
					not: PaymentStatus.SUCCEEDED,
				},
			},
			data: {
				status: PaymentStatus.SUCCEEDED,
				stripePaymentIntentId: paymentIntentId,
				failureReason: null,
			},
		});

		await tx.attempt.updateMany({
			where: {
				id: attemptId,
				status: AttemptStatus.PENDING_PAYMENT,
			},
			data: {
				status: AttemptStatus.READY,
			},
		});
	});
};

export const handleWebhook = async (
	rawBody: Buffer,
	signature: string | undefined,
) => {
	const stripe = getStripe();

	if (!config.STRIPE_WEBHOOK_SECRET) {
		throw new AppError(503, "Stripe webhook secret is not configured");
	}

	if (!signature) {
		throw new AppError(400, "Missing Stripe-Signature header");
	}

	let event: Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(
			rawBody,
			signature,
			config.STRIPE_WEBHOOK_SECRET,
		);
	} catch {
		throw new AppError(400, "Invalid Stripe webhook signature");
	}

	switch (event.type) {
		case "checkout.session.completed": {
			const session = event.data.object as Stripe.Checkout.Session;

			await markCheckoutPaid(session);

			break;
		}

		case "checkout.session.async_payment_succeeded": {
			const session = event.data.object as Stripe.Checkout.Session;

			await markCheckoutPaid(session);

			break;
		}

		case "checkout.session.expired": {
			const session = event.data.object as Stripe.Checkout.Session;

			const paymentId = session.metadata?.paymentId;

			if (paymentId) {
				await prisma.payment.updateMany({
					where: {
						id: paymentId,
						status: PaymentStatus.PENDING,
					},
					data: {
						status: PaymentStatus.CANCELLED,
					},
				});
			}

			break;
		}

		case "payment_intent.succeeded":
		case "payment_intent.payment_failed":
		case "payment_intent.canceled":
		case "payment_intent.processing": {
			const intent = event.data.object as Stripe.PaymentIntent;

			await syncPaymentIntent(intent);

			break;
		}

		default:
			break;
	}

	return {
		received: true,
		eventType: event.type,
	};
};

export const createCheckoutSession = async (
	candidateId: string,
	attemptId: string,
) => {
	const stripe = getStripe();

	const attempt = await prisma.attempt.findFirst({
		where: {
			id: attemptId,
			candidateId,
			deletedAt: null,
		},
		include: {
			assessment: true,
			payment: true,
			candidate: {
				select: {
					email: true,
				},
			},
		},
	});

	if (!attempt) {
		throw new AppError(404, "Attempt not found");
	}

	if (attempt.assessment.feeCents <= 0) {
		throw new AppError(409, "This assessment does not require payment");
	}

	if (attempt.payment?.status === PaymentStatus.SUCCEEDED) {
		throw new AppError(409, "Payment has already been completed");
	}

	if (attempt.status !== AttemptStatus.PENDING_PAYMENT) {
		throw new AppError(409, "Checkout cannot be created for this attempt");
	}

	const payment =
		attempt.payment ??
		(await prisma.payment.create({
			data: {
				attemptId,
				userId: candidateId,
				amountCents: attempt.assessment.feeCents,
				currency: attempt.assessment.currency,
				status: PaymentStatus.PENDING,
			},
		}));

	const session = await stripe.checkout.sessions.create({
		mode: "payment",

		payment_method_types: ["card"],

		customer_email: attempt.candidate.email,

		line_items: [
			{
				price_data: {
					currency: payment.currency,
					unit_amount: payment.amountCents,

					product_data: {
						name: attempt.assessment.title,
						description: "Developer Assessment Enrollment",
					},
				},

				quantity: 1,
			},
		],

		success_url: config.STRIPE_SUCCESS_URL,

		cancel_url: config.STRIPE_CANCEL_URL,

		client_reference_id: attemptId,

		metadata: {
			paymentId: payment.id,
			attemptId,
			candidateId,
		},

		payment_intent_data: {
			metadata: {
				paymentId: payment.id,
				attemptId,
				candidateId,
			},
		},
	});

	await prisma.payment.update({
		where: {
			id: payment.id,
		},
		data: {
			stripeCheckoutSessionId: session.id,
		},
	});

	await writeAuditLog(
		candidateId,
		"CHECKOUT_SESSION_CREATED",
		"Payment",
		payment.id,
		{
			attemptId,
			stripeCheckoutSessionId: session.id,
		},
	);

	return {
		paymentId: payment.id,
		sessionId: session.id,
		checkoutUrl: session.url,
	};
};
