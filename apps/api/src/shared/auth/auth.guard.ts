import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

import {
  SUPABASE_ANON,
  type SupabaseAnonClient,
} from "../database/supabase-anon.provider";

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    @Inject(SUPABASE_ANON) private readonly supabase: SupabaseAnonClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) {
      this.logger.debug(`Auth failed: ${error?.message ?? "no user"}`);
      throw new UnauthorizedException("Invalid or expired token");
    }

    request.user = {
      id: data.user.id,
      email: data.user.email ?? null,
      role: data.user.role ?? "authenticated",
    };
    request.accessToken = token;
    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [scheme, value] = header.split(" ");
    return scheme?.toLowerCase() === "bearer" ? value : undefined;
  }
}
