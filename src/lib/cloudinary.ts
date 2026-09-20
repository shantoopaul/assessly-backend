import { v2 as cloudinary } from "cloudinary";
import { config } from "../config";
import { AppError } from "../utils/AppError";

if (
	config.CLOUDINARY_CLOUD_NAME &&
	config.CLOUDINARY_API_KEY &&
	config.CLOUDINARY_API_SECRET
) {
	cloudinary.config({
		cloud_name: config.CLOUDINARY_CLOUD_NAME,
		api_key: config.CLOUDINARY_API_KEY,
		api_secret: config.CLOUDINARY_API_SECRET,
	});
}

export const uploadImageBuffer = async (buffer: Buffer) => {
	if (
		!config.CLOUDINARY_CLOUD_NAME ||
		!config.CLOUDINARY_API_KEY ||
		!config.CLOUDINARY_API_SECRET
	) {
		throw new AppError(503, "Cloudinary is not configured on this server :/");
	}

	return new Promise<string>((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{ folder: "assessly/avatars", resource_type: "image" },
			(error, result) => {
				if (error || !result?.secure_url) {
					reject(new AppError(502, "Image upload failed"));
					return;
				}
				resolve(result.secure_url);
			},
		);
		stream.end(buffer);
	});
};
