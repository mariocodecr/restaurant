import { Inject, Injectable, Scope } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { REQUEST } from "@nestjs/core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";
import type { Database } from "@restaurant/database";

import type { EnvVars } from "../config/env.validation";

/**
 * Per-request Supabase client that carries the caller's JWT via the
 * `accessToken` callback (modern supabase-js pattern, required when using
 * the new sb_publishable_* keys — the older global.headers Authorization
 * override is not honored in that config). RLS policies see auth.uid() =
 * the calling user, so all SELECT/INSERT/UPDATE/DELETE and RPC calls
 * enforce tenant isolation exactly as if the user queried Supabase directly.
 *
 * Request-scoped because each HTTP call has its own user token.
 */
@Injectable({ scope: Scope.REQUEST })
export class SupabaseRequestService {
  private cached?: SupabaseClient<Database>;

  constructor(
    private readonly config: ConfigService<EnvVars, true>,
    @Inject(REQUEST) private readonly request: Request & { accessToken?: string },
  ) {}

  get client(): SupabaseClient<Database> {
    if (this.cached) return this.cached;

    const token = this.request.accessToken;
    if (!token) {
      throw new Error(
        "SupabaseRequestService accessed without a request access token. " +
          "Ensure the route is protected by AuthGuard.",
      );
    }

    this.cached = createClient<Database>(
      this.config.get("SUPABASE_URL", { infer: true }),
      this.config.get("SUPABASE_PUBLISHABLE_KEY", { infer: true }),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        accessToken: () => Promise.resolve(token),
      },
    );
    return this.cached;
  }
}
