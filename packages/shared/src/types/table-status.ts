export const TABLE_STATUS = {
  AVAILABLE: "available",
  OCCUPIED: "occupied",
  WAITING_FOOD: "waiting_food",
  PENDING_PAYMENT: "pending_payment",
  RESERVED: "reserved",
} as const;

export type TableStatus = (typeof TABLE_STATUS)[keyof typeof TABLE_STATUS];
