-- Migration 009: tables (physical dining tables, scoped to a branch)
--
-- Status is plain TEXT + CHECK rather than CREATE TYPE so it can evolve
-- without an ALTER TYPE migration. Whitelist mirrors the TABLE_STATUS
-- constant exported from @restaurant/shared.

CREATE TABLE public.tables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  capacity        INTEGER NOT NULL DEFAULT 4
                    CHECK (capacity BETWEEN 1 AND 50),
  status          TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available','occupied','waiting_food','pending_payment','reserved')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A branch cannot have two tables with the same name.
  CONSTRAINT tables_branch_name_unique UNIQUE (branch_id, name)
);

CREATE INDEX tables_organization_id_idx ON public.tables (organization_id);
CREATE INDEX tables_branch_id_idx       ON public.tables (branch_id);

-- Hot path: load active tables of a branch in display order.
CREATE INDEX tables_branch_active_sort_idx
  ON public.tables (branch_id, sort_order)
  WHERE is_active = true;

-- Status filtering (e.g. "show occupied tables for the KDS").
CREATE INDEX tables_branch_status_idx
  ON public.tables (branch_id, status)
  WHERE is_active = true;

CREATE TRIGGER tables_set_updated_at
  BEFORE UPDATE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.tables IS
  'Physical dining tables. Scoped to a branch; status drives the visual map.';

-- ============================================================================
-- Integrity guard: table.organization_id MUST match branch.organization_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_table_branch_org_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  branch_org UUID;
BEGIN
  SELECT organization_id INTO branch_org
  FROM public.branches
  WHERE id = NEW.branch_id;

  IF branch_org IS NULL THEN
    RAISE EXCEPTION 'Branch % does not exist', NEW.branch_id;
  END IF;

  IF branch_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION
      'Table organization_id (%) does not match branch organization_id (%)',
      NEW.organization_id, branch_org;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tables_check_org_match
  BEFORE INSERT OR UPDATE OF branch_id, organization_id ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.check_table_branch_org_match();

-- ============================================================================
-- RLS — SELECT for any active member, INSERT/UPDATE/DELETE for managers
-- ============================================================================
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY tables_select_member
  ON public.tables
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY tables_insert_manager
  ON public.tables
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_manage_org(organization_id));

CREATE POLICY tables_update_manager
  ON public.tables
  FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_org(organization_id))
  WITH CHECK (public.user_can_manage_org(organization_id));

CREATE POLICY tables_delete_manager
  ON public.tables
  FOR DELETE
  TO authenticated
  USING (public.user_can_manage_org(organization_id));
