import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

export type TypedSupabaseClient = SupabaseClient<Database>;

export interface SupabaseClientConfig {
  url: string;
  key: string;
}

export function createSupabaseClient(config: SupabaseClientConfig): TypedSupabaseClient {
  return createClient<Database>(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
