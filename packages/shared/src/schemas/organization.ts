import { z } from "zod";

// Mirrors the DB CHECK constraints so the client catches invalid input
// before the request hits Postgres.
//   organizations.name   length BETWEEN 2 AND 120
//   organizations.slug   ^[a-z0-9]+(-[a-z0-9]+)*$  + length 3..60
//   organizations.currency  ^[A-Z]{3}$
//   branches.name        length BETWEEN 1 AND 80

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

export const BranchInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(40).optional(),
  timezone: z.string().trim().max(60).optional(),
});

export const CreateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(60)
    .regex(SLUG_REGEX, {
      message: "Slug must be lowercase letters, numbers and dashes only",
    }),
  currency: z.string().trim().toUpperCase().regex(CURRENCY_REGEX, {
    message: "Currency must be a 3-letter ISO 4217 code (e.g. USD, CRC, EUR)",
  }),
  timezone: z.string().trim().min(1).max(60),
  taxId: z.string().trim().max(40).optional(),
  firstBranch: BranchInputSchema,
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
export type BranchInput = z.infer<typeof BranchInputSchema>;
