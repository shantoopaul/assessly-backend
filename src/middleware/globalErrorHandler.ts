import type { ErrorRequestHandler } from "express";
import multer from 'multer';
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../utils/AppError';

export const globalErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  let statusCode = 500;
  let message = "Something went wrong";
  let errors: unknown[] = [];

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    errors = error.errors;
  } else if (error instanceof multer.MulterError) {
    statusCode = 400;
    message = error.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large" : error.message;
  } else if (error instanceof SyntaxError && "body" in error) {
    statusCode = 400;
    message = "Malformed JSON request body";
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      statusCode = 409;
      message = "A record with the same unique value already exists";
    } else if (error.code === "P2025") {
      statusCode = 404;
      message = "Requested record was not found";
    } else if (error.code === "P2003") {
      statusCode = 409;
      message = "Operation conflicts with an existing related record";
    } else if (error.code === "P2034") {
      statusCode = 409;
      message = "Concurrent update conflict; retry the request";
    } else {
      message = "Database operation failed";
    }
  } else if (error instanceof Error) {
    if (process.env.NODE_ENV !== "production") {
      errors = [{ message: error.message, stack: error.stack }];
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};