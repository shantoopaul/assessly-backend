import { Router } from "express";
import { authRouter } from "../modules/auth/auth.route";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);