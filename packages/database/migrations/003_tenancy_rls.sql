-- Migration 003: tenancy RLS, helper functions and auto-owner trigger
-- Locks down organizations/branches/memberships so a user can only ever see
-- data belonging to organizations they are an active member of.

-- ============================================================================
-- Helper functions
-- ----------------------------------------------------------------------------
-- All helpers are SECURITY DEFINER + STABLE so they can read memberships
-- without triggering RLS (which would recurse) and so the planner can cache
-- their results within a single query. We pin search_path to prevent any
-- caller from hijacking unqualified references.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT organization_id
  FROM public.memberships
  WHERE user_id = auth.uid()
    AND is_active = true;
$$;

COMMENT ON FUNCTION public.user_org_ids() IS
  'All organization_ids the current auth.uid() is an active member of. Used by RLS.';

CREATE OR REPLACE FUNCTION public.user_has_role_in_org(
  target_org_id UUID,
  required_role TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = auth.uid()
      AND organization_id = target_org_id
      AND role = required_role
      AND is_active = true
  );
$$;

-- Convenience: owner OR admin can manage org-level resources.
CREATE OR REPLACE FUNCTION public.user_can_manage_org(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = auth.uid()
      AND organization_id = target_org_id
      AND role IN ('owner', 'admin')
      AND is_active = true
  );
$$;

-- ============================================================================
-- Auto-create owner membership when an organization is inserted
-- ----------------------------------------------------------------------------
-- Without this, a brand new user could create an organization but immediately
-- be locked out (RLS would deny SELECT on it because they have no membership).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.memberships (user_id, organization_id, role)
  VALUES (NEW.owner_user_id, NEW.id, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_create_owner_membership
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.create_owner_membership();

-- ============================================================================
-- Enable RLS on all three tables
-- ============================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships   ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- organizations policies
-- ============================================================================
CREATE POLICY organizations_select_member
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.user_org_ids()));

CREATE POLICY organizations_insert_self
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY organizations_update_owner
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (public.user_has_role_in_org(id, 'owner'))
  WITH CHECK (public.user_has_role_in_org(id, 'owner'));

CREATE POLICY organizations_delete_owner
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (public.user_has_role_in_org(id, 'owner'));

-- ============================================================================
-- branches policies
-- ============================================================================
CREATE POLICY branches_select_member
  ON public.branches
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY branches_insert_manager
  ON public.branches
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_manage_org(organization_id));

CREATE POLICY branches_update_manager
  ON public.branches
  FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_org(organization_id))
  WITH CHECK (public.user_can_manage_org(organization_id));

CREATE POLICY branches_delete_manager
  ON public.branches
  FOR DELETE
  TO authenticated
  USING (public.user_can_manage_org(organization_id));

-- ============================================================================
-- memberships policies
-- ----------------------------------------------------------------------------
-- A user can always see their own memberships (needed for the app to know
-- "which orgs do I belong to?" before any other query runs). Owners/admins
-- can additionally see and manage all memberships in their org.
-- ============================================================================
CREATE POLICY memberships_select_self_or_manager
  ON public.memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.user_can_manage_org(organization_id)
  );

CREATE POLICY memberships_insert_manager
  ON public.memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_manage_org(organization_id));

CREATE POLICY memberships_update_manager
  ON public.memberships
  FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_org(organization_id))
  WITH CHECK (public.user_can_manage_org(organization_id));

CREATE POLICY memberships_delete_manager
  ON public.memberships
  FOR DELETE
  TO authenticated
  USING (public.user_can_manage_org(organization_id));

-- ============================================================================
-- Function permissions
-- ----------------------------------------------------------------------------
-- Functions are SECURITY DEFINER (run as the table owner) but we still need
-- the 'authenticated' role to be allowed to call them at all.
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_role_in_org(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_org(UUID) TO authenticated;
