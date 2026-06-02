import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@restaurant/database";

import { supabaseEnv } from "./env";

export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    supabaseEnv.url,
    supabaseEnv.publishableKey,
  );
}
