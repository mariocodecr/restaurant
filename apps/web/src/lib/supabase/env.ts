// IMPORTANT: NEXT_PUBLIC_* vars must be referenced as literal property accesses
// (process.env.NEXT_PUBLIC_FOO) so Next.js can statically inline them into the
// client bundle. Dynamic lookups like process.env[name] are NOT inlined and
// will be undefined in the browser.
function assertEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const supabaseEnv = {
  url: assertEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  publishableKey: assertEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
};
