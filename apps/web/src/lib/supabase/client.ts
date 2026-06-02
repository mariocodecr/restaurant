import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@restaurant/database";

import { supabaseEnv } from "./env";

export function createClient() {
  return createBrowserClient<Database>(
    supabaseEnv.url,
    supabaseEnv.publishableKey,
  );
}
