import { Router } from "express";
import { assessmentRouter } from "../modules/assessments/assessment.route";
import { authRouter } from "../modules/auth/auth.route";
import { userRouter } from "../modules/users/user.route";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/assessments", assessmentRouter);
