import { z } from "zod";

export const PAYMENT_METHOD = {
  CASH: "cash",
  CARD: "card",
  TRANSFER: "transfer",
  OTHER: "other",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

const paymentMethodValues = Object.values(PAYMENT_METHOD) as [string, ...string[]];

const moneyAmount = z
  .number()
  .positive()
  .max(999_999_999.99)
  .refine((n) => Number.isFinite(n) && Math.round(n * 100) === n * 100, {
    message: "Money values must have at most 2 decimal places",
  });

export const AddPaymentSchema = z.object({
  method: z.enum(paymentMethodValues),
  amount: moneyAmount,
  reference: z.string().trim().max(120).optional(),
});

export const UpdateInvoiceCustomerSchema = z
  .object({
    customerName: z.string().trim().max(200).nullable().optional(),
    customerTaxId: z.string().trim().max(40).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type AddPaymentInput = z.infer<typeof AddPaymentSchema>;
export type UpdateInvoiceCustomerInput = z.infer<typeof UpdateInvoiceCustomerSchema>;
