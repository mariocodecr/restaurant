-- Migration 014: membership helper functions
--
-- The API can't read auth.users with the per-request (RLS-scoped) client
-- — auth.users is in a protected schema. Two SECURITY DEFINER helpers
-- give us the minimum needed for the Team module without exposing
-- service_role on the API:
--
--   find_user_by_email(email)  → uuid or null
--   list_org_members(org_id)   → table of (member_id, user_id, email,
--                                full_name, role, branch_id, is_active,
--                                created_at)
--
-- Both check that the caller is an authenticated user of the right
-- privilege; list_org_members specifically requires manager rights so
-- staff can't enumerate the org roster.

-- ============================================================================
-- find_user_by_email — case-insensitive lookup, only by authenticated
-- callers. Returns NULL when no user has that email (so the API can
-- map to a friendly "user must sign up first" response).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.find_user_by_email(target_email TEXT)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT id
    FROM auth.users
   WHERE lower(email) = lower(target_email)
   LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.find_user_by_email(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.find_user_by_email(TEXT) TO authenticated;

-- ============================================================================
-- list_org_members — single round-trip to get the joined roster.
-- Caller must be an active owner/admin of the org; otherwise empty set.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.list_org_members(target_org_id UUID)
RETURNS TABLE (
  membership_id UUID,
  user_id       UUID,
  email         TEXT,
  full_name     TEXT,
  role          TEXT,
  branch_id     UUID,
  is_active     BOOLEAN,
  created_at    TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    m.id                                                     AS membership_id,
    m.user_id,
    u.email::text,
    (u.raw_user_meta_data ->> 'full_name')::text             AS full_name,
    m.role,
    m.branch_id,
    m.is_active,
    m.created_at
  FROM public.memberships m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.organization_id = target_org_id
    AND public.user_can_manage_org(target_org_id)
  ORDER BY
    CASE m.role
      WHEN 'owner'   THEN 1
      WHEN 'admin'   THEN 2
      WHEN 'waiter'  THEN 3
      WHEN 'kitchen' THEN 4
      ELSE 5
    END,
    u.email;
$$;

REVOKE EXECUTE ON FUNCTION public.list_org_members(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_org_members(UUID) TO authenticated;
