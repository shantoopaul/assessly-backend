import { getStripe } from "../../lib/stripe";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { getAuthenticatedUser } from "../../utils/getAuthenticatedUser";
import { getRouteParam } from "../../utils/getRouteParam";
import { sendResponse } from "../../utils/sendResponse";
import * as PaymentService from "./payment.service";

export const initiate = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const attemptId = getRouteParam(req.params.attemptId, "attemptId");
	const result = await PaymentService.initiate(
		user.id,
		attemptId,
		req.body.paymentMethodId,
	);
	sendResponse(res, 201, "Payment initiated successfully", result);
});

export const confirm = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const paymentId = getRouteParam(req.params.paymentId, "paymentId");
	const result = await PaymentService.confirm(
		user.id,
		paymentId,
		req.body.paymentMethodId,
	);
	sendResponse(res, 200, "Payment confirmation processed", result);
});

export const getById = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const paymentId = getRouteParam(req.params.paymentId, "paymentId");
	const result = await PaymentService.getById(user, paymentId);
	sendResponse(res, 200, "Payment retrieved successfully", result);
});

export const getByAttempt = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const attemptId = getRouteParam(req.params.attemptId, "attemptId");
	const result = await PaymentService.getByAttempt(user.id, attemptId);
	sendResponse(res, 200, "Payment retrieved successfully", result);
});

export const webhook = catchAsync(async (req, res) => {
	const result = await PaymentService.handleWebhook(
		req.body as Buffer,
		req.headers["stripe-signature"] as string | undefined,
	);
	sendResponse(res, 200, "Webhook processed successfully", result);
});

export const createCheckoutSession = catchAsync(async (req, res) => {
	const user = getAuthenticatedUser(req.user);
	const attemptId = getRouteParam(req.params.attemptId, "attemptId");
	const result = await PaymentService.createCheckoutSession(user.id, attemptId);

	sendResponse(res, 201, "Checkout session created successfully", result);
});

export const checkoutSuccess = catchAsync(async (req, res) => {
	const sessionId = req.query.session_id;

	if (typeof sessionId !== "string" || !sessionId) {
		throw new AppError(400, "Missing Checkout Session ID");
	}

	const stripe = getStripe();

	const session = await stripe.checkout.sessions.retrieve(sessionId);

	res.status(200).send(`
      <html>
        <head>
          <title>Payment Successful</title>
        </head>

        <body style="font-family: Arial; padding: 32px;">
          <h1>Payment completed</h1>
          <p>Stripe Session: ${session.id}</p>
          <p>Payment status: ${session.payment_status}</p>
        </body>
      </html>
    `);
});

export const checkoutCancel = catchAsync(async (_req, res) => {
	res.status(200).send(`
      <html>
        <head>
          <title>Payment Cancelled</title>
        </head>

        <body style="font-family: Arial; padding: 32px;">
          <h1>Payment cancelled</h1>
          <p>The payment was cancelled :/</p>
        </body>
      </html>
    `);
});
