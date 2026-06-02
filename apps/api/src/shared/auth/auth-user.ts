export interface AuthUser {
  id: string;
  email: string | null;
  role: string;
}

declare module "express" {
  interface Request {
    user?: AuthUser;
    accessToken?: string;
  }
}
