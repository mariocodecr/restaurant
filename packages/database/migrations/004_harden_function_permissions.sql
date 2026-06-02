-- Migration 004: harden function permissions and search_path
-- Addresses Supabase database-linter warnings raised after migrations 001-003:
--   * 0011 function_search_path_mutable on set_updated_at
--   * 0028 anon_security_definer_function_executable on helper functions
--   * 0029 authenticated_security_definer_function_executable on the trigger fn

-- ----------------------------------------------------------------------------
-- Fix 1: pin search_path on set_updated_at (forgotten in migration 001).
-- Without it, a malicious search_path could redirect now() or trigger
-- execution to attacker-controlled schemas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Fix 2: create_owner_membership is a trigger function. It should NEVER be
-- callable via the PostgREST /rpc/ interface. Revoke from every role.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_owner_membership()
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Fix 3: helper functions must require authentication. They return data
-- scoped to the calling auth.uid(), so unauthenticated callers must not
-- be able to invoke them at all (a NULL auth.uid() would silently return
-- empty/false results, which is fine, but exposing them is bad hygiene).
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.user_org_ids()
  FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.user_has_role_in_org(UUID, TEXT)
  FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.user_can_manage_org(UUID)
  FROM PUBLIC, anon;

-- Re-grant to authenticated. The original GRANTs in migration 003 may have
-- been wiped by the broader REVOKE FROM PUBLIC above (PUBLIC includes
-- authenticated implicitly in some Postgres versions), so we restate them.
GRANT EXECUTE ON FUNCTION public.user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_role_in_org(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_org(UUID) TO authenticated;
