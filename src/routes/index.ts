import { Router } from "express";
import { adminRouter } from "../modules/admin/admin.route";
import { assessmentRouter } from "../modules/assessments/assessment.route";
import { attemptRouter } from "../modules/attempts/attempt.route";
import { authRouter } from "../modules/auth/auth.route";
import { paymentRouter } from "../modules/payments/payment.route";
import { reviewRouter } from "../modules/reviews/review.route";
import { userRouter } from "../modules/users/user.route";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/assessments", assessmentRouter);
apiRouter.use("/attempts", attemptRouter);
apiRouter.use("/reviews", reviewRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/admin", adminRouter);
