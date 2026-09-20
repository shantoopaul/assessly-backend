import type { Response } from "express";

type Meta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  message: string,
  data: T,
  meta?: Meta
) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {})
  });
};