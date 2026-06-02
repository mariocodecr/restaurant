-- Migration 006: convert empty strings to NULL inside create_organization_with_branch
--
-- The generated TS types mark every RPC arg as a required string. To keep
-- the API typed cleanly we always send strings, mapping omitted optional
-- fields to "". Without NULLIF, those would be stored as empty strings,
-- which is wrong: an absent tax_id should be NULL, not ''.

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
    auth.uid()
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
