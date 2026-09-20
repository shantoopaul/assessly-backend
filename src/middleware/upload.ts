import multer from "multer";
import { AppError } from "../utils/AppError";

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new AppError(400, "Only JPEG, PNG, or WebP images are allowed"));
      return;
    }
    callback(null, true);
  }
});