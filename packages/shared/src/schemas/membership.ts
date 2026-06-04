import { z } from "zod";

import { ROLES } from "../types/roles.js";

const roleValues = Object.values(ROLES) as [string, ...string[]];

export const AddMembershipSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(roleValues),
  branchId: z.string().uuid().nullable().optional(),
});

export const UpdateMembershipSchema = z
  .object({
    role: z.enum(roleValues).optional(),
    branchId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type AddMembershipInput = z.infer<typeof AddMembershipSchema>;
export type UpdateMembershipInput = z.infer<typeof UpdateMembershipSchema>;
