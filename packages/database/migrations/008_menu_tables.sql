-- Migration 008: menu tables (categories + products) with RLS
--
-- Two tables for the menu domain, both scoped per organization_id and
-- following the existing tenancy RLS pattern (any active member SELECTs,
-- only owners/admins MUTATE). A row-level trigger prevents cross-org
-- category/product mismatches even if the API misbehaves.

-- ============================================================================
-- categories
-- ============================================================================
CREATE TABLE public.categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A single org cannot have two categories with the same name.
  CONSTRAINT categories_org_name_unique UNIQUE (organization_id, name)
);

CREATE INDEX categories_organization_id_idx
  ON public.categories (organization_id);

-- Hot path: load active categories ordered for display.
CREATE INDEX categories_org_active_sort_idx
  ON public.categories (organization_id, sort_order)
  WHERE is_active = true;

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.categories IS
  'Menu categories (Entradas, Platos fuertes, Bebidas, ...). Org-scoped, sortable.';

-- ============================================================================
-- products
-- ============================================================================
-- price/cost as NUMERIC(10,2) — never use float for money. Allow zero
-- price (think "courtesy items") and zero cost (no recipe yet).
CREATE TABLE public.products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description     TEXT CHECK (description IS NULL OR length(description) <= 500),
  price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  cost            NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  image_url       TEXT CHECK (image_url IS NULL OR length(image_url) <= 1024),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_organization_id_idx
  ON public.products (organization_id);

CREATE INDEX products_category_id_idx
  ON public.products (category_id);

-- Hot path: load active products of an org for menu display.
CREATE INDEX products_org_active_sort_idx
  ON public.products (organization_id, sort_order)
  WHERE is_active = true;

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.products IS
  'Menu items. Org-scoped, belong to one category. Price/cost in NUMERIC(10,2).';

-- ============================================================================
-- Integrity guard: product.organization_id MUST match category.organization_id
-- ----------------------------------------------------------------------------
-- RLS prevents cross-org INSERT via WITH CHECK (org must be in user_org_ids),
-- but it does NOT verify that the supplied category_id belongs to the same
-- org. This trigger closes that loophole defensively.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_product_category_org_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  cat_org UUID;
BEGIN
  SELECT organization_id INTO cat_org
  FROM public.categories
  WHERE id = NEW.category_id;

  IF cat_org IS NULL THEN
    RAISE EXCEPTION 'Category % does not exist', NEW.category_id;
  END IF;

  IF cat_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION
      'Product organization_id (%) does not match category organization_id (%)',
      NEW.organization_id, cat_org;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER products_check_org_match
  BEFORE INSERT OR UPDATE OF category_id, organization_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.check_product_category_org_match();

-- ============================================================================
-- RLS — identical pattern to branches:
--   SELECT: any active member of the org
--   INSERT/UPDATE/DELETE: only owners/admins (user_can_manage_org)
-- ============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products   ENABLE ROW LEVEL SECURITY;

-- Categories
CREATE POLICY categories_select_member
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY categories_insert_manager
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_manage_org(organization_id));

CREATE POLICY categories_update_manager
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_org(organization_id))
  WITH CHECK (public.user_can_manage_org(organization_id));

CREATE POLICY categories_delete_manager
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (public.user_can_manage_org(organization_id));

-- Products
CREATE POLICY products_select_member
  ON public.products
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY products_insert_manager
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_manage_org(organization_id));

CREATE POLICY products_update_manager
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.user_can_manage_org(organization_id))
  WITH CHECK (public.user_can_manage_org(organization_id));

CREATE POLICY products_delete_manager
  ON public.products
  FOR DELETE
  TO authenticated
  USING (public.user_can_manage_org(organization_id));
