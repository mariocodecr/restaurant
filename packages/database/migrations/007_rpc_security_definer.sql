-- Migration 007: convert create_organization_with_branch to SECURITY DEFINER
--
-- WHY:
--   The SECURITY INVOKER version (migrations 005 + 006) was rejected by RLS
--   with 42501 ("new row violates row-level security policy for table
--   organizations") even when called by a properly authenticated user whose
--   auth.uid() matched the owner_user_id being inserted. Direct INSERTs
--   from the same authenticated session worked; only INSERTs *inside* a
--   SECURITY INVOKER plpgsql function failed. The root cause is a Postgres
--   /Supabase quirk around how the JWT-derived session settings propagate
--   into WITH CHECK evaluation when the INSERT is wrapped in a SECURITY
--   INVOKER function — auth.uid() returns the correct UID at top-level but
--   the policy expression doesn't see the expected value during the
--   row-write phase, so `owner_user_id = auth.uid()` fails.
--
-- WHY SECURITY DEFINER IS SAFE HERE:
--   * The function captures `auth.uid()` into a local at entry and uses
--     that captured value as owner_user_id. The CALLER cannot pass in or
--     spoof a different owner — they supply only descriptive fields.
--   * The function is GRANTed only to the `authenticated` role; anon
--     and PUBLIC cannot reach it.
--   * Postgres (the function owner) is the table owner and bypasses RLS,
--     which is exactly what we need to insert the org row AND let the
--     AFTER INSERT trigger create_owner_membership() insert into
--     memberships without hitting user_can_manage_org() (which would fail
--     because the user has no memberships yet — classic chicken-and-egg).
--   * search_path is pinned to public, pg_temp so the function cannot be
--     hijacked via search_path manipulation.

CREATE OR REPLACE FUNCTION public.create_organization_with_branch(
  org_name        TEXT,
  org_slug        TEXT,
  org_currency    TEXT,
  org_timezone    TEXT,
  org_tax_id      TEXT,
  branch_name     TEXT,
  branch_address  TEXT,
  branch_phone    TEXT,
  branch_timezone TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id  uuid := auth.uid();
  new_org    public.organizations;
  new_branch public.branches;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null - RPC must be called by an authenticated user';
  END IF;

  INSERT INTO public.organizations (
    name, slug, currency, timezone, tax_id, owner_user_id
  )
  VALUES (
    org_name,
    org_slug,
    org_currency,
    org_timezone,
    NULLIF(org_tax_id, ''),
    caller_id
  )
  RETURNING * INTO new_org;

  INSERT INTO public.branches (
    organization_id, name, address, phone, timezone
  )
  VALUES (
    new_org.id,
    branch_name,
    NULLIF(branch_address, ''),
    NULLIF(branch_phone, ''),
    NULLIF(branch_timezone, '')
  )
  RETURNING * INTO new_branch;

  RETURN jsonb_build_object(
    'organization', to_jsonb(new_org),
    'branch',       to_jsonb(new_branch)
  );
END;
$$;

-- Lock down EXECUTE: only authenticated can call. Anon/public can't.
REVOKE EXECUTE ON FUNCTION public.create_organization_with_branch(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_organization_with_branch(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
