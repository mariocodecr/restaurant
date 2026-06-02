import { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@restaurant/database";

import type { EnvVars } from "../config/env.validation";

export const SUPABASE_ANON = Symbol("SUPABASE_ANON");

export type SupabaseAnonClient = SupabaseClient<Database>;

/**
 * App-wide Supabase client using the publishable (anon) key. Used for things
 * that don't depend on a user session — primarily validating bearer tokens
 * via supabase.auth.getUser(token).
 *
 * Anything that needs RLS-scoped data access must use the per-request
 * SupabaseRequestClient (see supabase-request.service.ts) instead.
 */
export const supabaseAnonProvider: Provider = {
  provide: SUPABASE_ANON,
  inject: [ConfigService],
  useFactory: (config: ConfigService<EnvVars, true>): SupabaseAnonClient => {
    return createClient<Database>(
      config.get("SUPABASE_URL", { infer: true }),
      config.get("SUPABASE_PUBLISHABLE_KEY", { infer: true }),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  },
};
