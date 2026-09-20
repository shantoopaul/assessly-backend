import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../utils/AppError";

export const validateRequest = (schema: ZodType): RequestHandler => {
  return (req, _res, next) => {
    const parsed = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }));
      next(new AppError(400, "Validation failed", errors));
      return;
    }

    const data = parsed.data as {
      body?: unknown;
      params?: unknown;
      query?: unknown;
    };

    if (data.body !== undefined) req.body = data.body;
    if (data.params !== undefined) Object.assign(req.params, data.params as Record<string, string>);
    next();
  };
};