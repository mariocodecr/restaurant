import { z } from "zod";

// Mirrors public.products CHECK constraints:
//   name        length BETWEEN 1 AND 120
//   description length <= 500 (nullable)
//   price       NUMERIC(10,2) >= 0
//   cost        NUMERIC(10,2) >= 0
//   image_url   length <= 1024 (nullable)

const moneyAmount = z
  .number()
  .min(0)
  .max(99_999_999.99)
  .refine((n) => Number.isFinite(n) && Math.round(n * 100) === n * 100, {
    message: "Money values must have at most 2 decimal places",
  });

export const CreateProductSchema = z.object({
  organizationId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  price: moneyAmount,
  cost: moneyAmount.optional(),
  imageUrl: z.string().url().max(1024).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const UpdateProductSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    price: moneyAmount.optional(),
    cost: moneyAmount.optional(),
    imageUrl: z.string().url().max(1024).nullable().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
