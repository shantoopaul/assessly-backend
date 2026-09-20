import { z } from "zod";

export const updateMeSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional()
    })
    .refine((data) => Object.keys(data).length > 0, "At least one field is required")
});