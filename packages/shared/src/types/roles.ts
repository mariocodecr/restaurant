export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  WAITER: "waiter",
  KITCHEN: "kitchen",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.OWNER]: 100,
  [ROLES.ADMIN]: 75,
  [ROLES.WAITER]: 50,
  [ROLES.KITCHEN]: 25,
};
