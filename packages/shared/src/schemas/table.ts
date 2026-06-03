import { z } from "zod";

import { TABLE_STATUS } from "../types/table-status.js";

// Mirrors public.tables CHECK constraints:
//   name      length BETWEEN 1 AND 40
//   capacity  INTEGER BETWEEN 1 AND 50
//   status    one of TABLE_STATUS values

const tableStatusValues = Object.values(TABLE_STATUS) as [string, ...string[]];

export const CreateTableSchema = z.object({
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
  capacity: z.number().int().min(1).max(50).optional(),
  status: z.enum(tableStatusValues).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const UpdateTableSchema = z
  .object({
    branchId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(40).optional(),
    capacity: z.number().int().min(1).max(50).optional(),
    status: z.enum(tableStatusValues).optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateTableInput = z.infer<typeof CreateTableSchema>;
export type UpdateTableInput = z.infer<typeof UpdateTableSchema>;
