import { z } from "zod";

// Mirrors public.categories CHECK constraints:
//   name        length BETWEEN 1 AND 80
//   sort_order  INTEGER
//   is_active   BOOLEAN

export const CreateCategorySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

// All fields optional for PATCH, but at least one must be present.
export const UpdateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
