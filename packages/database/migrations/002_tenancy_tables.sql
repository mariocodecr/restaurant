-- Migration 002: tenancy tables (organizations + branches + memberships)
-- The multi-tenant backbone. Every domain table downstream will FK to one of these.

-- ============================================================================
-- organizations: the tenant root entity
-- ============================================================================
CREATE TABLE public.organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL
                    CHECK (length(name) BETWEEN 2 AND 120),
  slug            TEXT NOT NULL UNIQUE
                    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
                       AND length(slug) BETWEEN 3 AND 60),
  tax_id          TEXT,
  currency        TEXT NOT NULL DEFAULT 'USD'
                    CHECK (currency ~ '^[A-Z]{3}$'),
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  owner_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FKs in Postgres are NOT auto-indexed. owner_user_id is queried on
-- "what orgs does this user own?" lookups and during cascade checks.
CREATE INDEX organizations_owner_user_id_idx
  ON public.organizations (owner_user_id);

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.organizations IS
  'Tenant root. Every downstream domain table FKs to organization_id and is gated by RLS.';

-- ============================================================================
-- branches: physical locations under an organization
-- ============================================================================
CREATE TABLE public.branches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL
                     CHECK (length(name) BETWEEN 1 AND 80),
  address          TEXT,
  phone            TEXT,
  timezone         TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A single org cannot have two branches with the same name.
  CONSTRAINT branches_org_name_unique UNIQUE (organization_id, name)
);

CREATE INDEX branches_organization_id_idx
  ON public.branches (organization_id);

-- Partial index: most operational queries (mesa map, KDS, etc.) only care
-- about active branches. Smaller index = faster lookups for the hot path.
CREATE INDEX branches_active_by_org_idx
  ON public.branches (organization_id)
  WHERE is_active = true;

CREATE TRIGGER branches_set_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- memberships: user × org × (optional branch) × role
-- ============================================================================
-- A NULL branch_id means "this membership applies to ALL branches of the org"
-- (typical for owners and admins). A non-NULL branch_id scopes the membership
-- to a single branch (typical for waiters and kitchen staff).
CREATE TABLE public.memberships (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  role             TEXT NOT NULL
                     CHECK (role IN ('owner', 'admin', 'waiter', 'kitchen')),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- NULLS NOT DISTINCT (PG15+) treats NULL branch_id values as equal, so we
  -- prevent duplicate org-wide memberships for the same user+role.
  CONSTRAINT memberships_unique_assignment
    UNIQUE NULLS NOT DISTINCT (user_id, organization_id, branch_id, role)
);

-- The single most-queried path: "find all active memberships for this user".
-- Used by every RLS policy and the JWT enrichment hook.
CREATE INDEX memberships_user_active_idx
  ON public.memberships (user_id, organization_id)
  WHERE is_active = true;

CREATE INDEX memberships_organization_id_idx
  ON public.memberships (organization_id);

CREATE INDEX memberships_branch_id_idx
  ON public.memberships (branch_id)
  WHERE branch_id IS NOT NULL;

CREATE TRIGGER memberships_set_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.memberships IS
  'Join table: which users have which role in which org/branch. NULL branch_id = org-wide.';
