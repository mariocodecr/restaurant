-- Migration 005: atomic create-org-with-branch RPC for the onboarding flow.
--
-- We need to insert an organization AND its first branch in a single
-- transaction. Doing it with two separate REST calls leaves a window where
-- the org exists without a branch, and a manual rollback after the failed
-- branch insert can itself fail.
--
-- A SQL function gives us one transaction with all-or-nothing semantics.
-- SECURITY INVOKER ensures RLS still applies (the user gets the same
-- permissions as if they ran the inserts directly), and the trigger
-- create_owner_membership() still fires after the organization insert,
-- so by the time we try to insert the branch the caller already has the
-- 'owner' role and passes user_can_manage_org() in branches' INSERT policy.

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
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_org    public.organizations;
  new_branch public.branches;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — RPC must be called by an authenticated user';
  END IF;

  -- Trigger create_owner_membership fires immediately after the row is
  -- written, registering the caller as 'owner' before we move on.
  INSERT INTO public.organizations (
    name, slug, currency, timezone, tax_id, owner_user_id
  )
  VALUES (
    org_name, org_slug, org_currency, org_timezone, org_tax_id, auth.uid()
  )
  RETURNING * INTO new_org;

  INSERT INTO public.branches (
    organization_id, name, address, phone, timezone
  )
  VALUES (
    new_org.id, branch_name, branch_address, branch_phone, branch_timezone
  )
  RETURNING * INTO new_branch;

  RETURN jsonb_build_object(
    'organization', to_jsonb(new_org),
    'branch',       to_jsonb(new_branch)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_organization_with_branch(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_organization_with_branch(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.create_organization_with_branch(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) IS
  'Atomic onboarding: insert organization (auto-creates owner membership via trigger) + first branch in one transaction. SECURITY INVOKER so RLS applies.';
