import { Router } from 'express';
import { Role } from '../../../generated/prisma/enums';
import { auth } from '../../middleware/auth';
import { uploadAvatar } from '../../middleware/upload';
import { validateRequest } from '../../middleware/validateRequest';
import * as controller from './user.controller';
import { updateMeSchema } from './user.validation';

export const userRouter = Router();

userRouter.use(auth(Role.CANDIDATE, Role.REVIEWER, Role.ADMIN));
userRouter.get("/me", controller.getMe);
userRouter.patch("/me", validateRequest(updateMeSchema), controller.updateMe);
userRouter.patch("/me/avatar", uploadAvatar.single("profileImage"), controller.uploadAvatar);