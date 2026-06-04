import { z } from "zod";

// Mirrors DB CHECK constraints for ingredients + stock_movements.

const moneyAmount = z
  .number()
  .min(0)
  .max(999_999_999.99)
  .refine((n) => Number.isFinite(n) && Math.round(n * 100) === n * 100, {
    message: "Money values must have at most 2 decimal places",
  });

// Stock quantity uses NUMERIC(12,3) — up to 3 decimal places.
const stockAmount = z
  .number()
  .min(-999_999_999.999)
  .max(999_999_999.999)
  .refine((n) => Number.isFinite(n) && Math.round(n * 1000) === n * 1000, {
    message: "Stock quantities can have at most 3 decimal places",
  });

const positiveStockAmount = stockAmount.refine((n) => n > 0, {
  message: "Quantity must be greater than zero",
});

// ---- Ingredients ----------------------------------------------------------

export const CreateIngredientSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(20),
  currentCost: moneyAmount.optional(),
  minStockAlert: stockAmount.refine((n) => n >= 0, {
    message: "Minimum stock cannot be negative",
  }).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const UpdateIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    unit: z.string().trim().min(1).max(20).optional(),
    currentCost: moneyAmount.optional(),
    minStockAlert: stockAmount.refine((n) => n >= 0).nullable().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// ---- Stock movements ------------------------------------------------------

export const STOCK_MOVEMENT_KIND = {
  ENTRADA: "entrada",
  SALIDA: "salida",
  AJUSTE: "ajuste",
  // 'venta' is reserved for the future auto-deduction trigger.
} as const;

export type StockMovementKind =
  (typeof STOCK_MOVEMENT_KIND)[keyof typeof STOCK_MOVEMENT_KIND];

const manualKindValues = Object.values(STOCK_MOVEMENT_KIND) as [string, ...string[]];

// For 'entrada' and 'salida' the UI supplies a POSITIVE quantity and we
// derive the sign on the server. For 'ajuste' the user picks a sign in
// the form (+ or -), so we accept a signed quantity. The schema accepts
// signed; the API enforces the sign convention.
export const CreateStockMovementSchema = z.object({
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  kind: z.enum(manualKindValues),
  quantity: positiveStockAmount,
  // For 'ajuste': true = increase (+), false = decrease (-). Ignored for
  // entrada (always +) / salida (always -).
  isPositive: z.boolean().optional(),
  unitCost: moneyAmount.optional(),
  notes: z.string().trim().max(500).optional(),
});

export type CreateIngredientInput = z.infer<typeof CreateIngredientSchema>;
export type UpdateIngredientInput = z.infer<typeof UpdateIngredientSchema>;
export type CreateStockMovementInput = z.infer<typeof CreateStockMovementSchema>;
