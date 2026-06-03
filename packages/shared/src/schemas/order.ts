import { z } from "zod";

import { ORDER_STATUS } from "../types/order-status.js";

const orderStatusValues = Object.values(ORDER_STATUS) as [string, ...string[]];

const moneyAmount = z
  .number()
  .min(0)
  .max(999_999_999.99)
  .refine((n) => Number.isFinite(n) && Math.round(n * 100) === n * 100, {
    message: "Money values must have at most 2 decimal places",
  });

// ---- Order header ----------------------------------------------------------

export const CreateOrderSchema = z.object({
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
  // tableId nullable so kiosk/delivery orders are possible later.
  tableId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const UpdateOrderHeaderSchema = z
  .object({
    tableId: z.string().uuid().nullable().optional(),
    discountAmount: moneyAmount.optional(),
    taxAmount: moneyAmount.optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// ---- Status transition -----------------------------------------------------

export const TransitionOrderSchema = z.object({
  to: z.enum(orderStatusValues),
});

// ---- Order items -----------------------------------------------------------

export const AddOrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
  notes: z.string().trim().max(500).optional(),
  // Optional overrides — normally the server snapshots from the product.
  unitPriceOverride: moneyAmount.optional(),
});

export const UpdateOrderItemSchema = z
  .object({
    quantity: z.number().int().min(1).max(999).optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// ---- Types ----------------------------------------------------------------

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderHeaderInput = z.infer<typeof UpdateOrderHeaderSchema>;
export type TransitionOrderInput = z.infer<typeof TransitionOrderSchema>;
export type AddOrderItemInput = z.infer<typeof AddOrderItemSchema>;
export type UpdateOrderItemInput = z.infer<typeof UpdateOrderItemSchema>;
