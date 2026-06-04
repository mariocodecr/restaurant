-- Migration 015: inventory — ingredients + stock_movements + stock_levels
--
-- Three tables that model inventory tracking per branch:
--   ingredients      Catalog at the org level (name, unit, current cost)
--   stock_movements  Branch-scoped append-only log of every stock change
--                    (entrada / salida / ajuste). The signed quantity_delta
--                    column is the source of truth.
--   stock_levels     Materialized current quantity per (branch, ingredient)
--                    kept in sync by a trigger on stock_movements.
--
-- RLS:
--   ingredients      members SELECT, managers MUTATE
--   stock_movements  members SELECT, managers INSERT/DELETE
--                    (UPDATE not allowed — movements are append-only audit)
--   stock_levels     members SELECT, no direct writes (trigger only)

-- ============================================================================
-- ingredients (catalog)
-- ============================================================================
CREATE TABLE public.ingredients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  unit            TEXT NOT NULL CHECK (length(unit) BETWEEN 1 AND 20),
  current_cost    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (current_cost >= 0),

  -- When set, the UI flags a branch as 'low stock' if quantity < this value.
  min_stock_alert NUMERIC(12,3) CHECK (min_stock_alert IS NULL OR min_stock_alert >= 0),

  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ingredients_org_name_unique UNIQUE (organization_id, name)
);

CREATE INDEX ingredients_organization_id_idx ON public.ingredients (organization_id);
CREATE INDEX ingredients_org_active_idx
  ON public.ingredients (organization_id, sort_order)
  WHERE is_active = true;

CREATE TRIGGER ingredients_set_updated_at
  BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.ingredients IS
  'Catalog of ingredients per organization. Stock levels live in stock_levels, scoped per branch.';

-- ============================================================================
-- stock_movements (append-only log)
-- ----------------------------------------------------------------------------
-- quantity_delta is SIGNED — positive for inflows (entrada / positive
-- ajuste), negative for outflows (salida / negative ajuste). The 'kind'
-- column is purely descriptive for UI; the sign tells the math.
-- ============================================================================
CREATE TABLE public.stock_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id           UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  ingredient_id       UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,

  kind                TEXT NOT NULL CHECK (kind IN ('entrada','salida','ajuste','venta')),
  quantity_delta      NUMERIC(12,3) NOT NULL CHECK (quantity_delta <> 0),
  unit_cost           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),

  notes               TEXT CHECK (notes IS NULL OR length(notes) <= 500),

  -- Optional FK back to the order item that caused a 'venta' movement
  -- when the auto-deduction feature lands. NULL for manual movements.
  order_item_id       UUID REFERENCES public.order_items(id) ON DELETE SET NULL,

  created_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX stock_movements_organization_id_idx ON public.stock_movements (organization_id);
CREATE INDEX stock_movements_branch_id_idx ON public.stock_movements (branch_id);
CREATE INDEX stock_movements_ingredient_id_idx ON public.stock_movements (ingredient_id);
CREATE INDEX stock_movements_branch_created_idx
  ON public.stock_movements (branch_id, created_at DESC);

COMMENT ON TABLE public.stock_movements IS
  'Append-only ledger of stock changes. The sign of quantity_delta drives the math; kind is for display.';

-- Org-match guard: movement.organization_id must match branch + ingredient
CREATE OR REPLACE FUNCTION public.check_stock_movement_org_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  branch_org     UUID;
  ingredient_org UUID;
BEGIN
  SELECT organization_id INTO branch_org FROM public.branches WHERE id = NEW.branch_id;
  IF branch_org IS NULL THEN RAISE EXCEPTION 'Branch % does not exist', NEW.branch_id; END IF;
  IF branch_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Movement org (%) does not match branch org (%)', NEW.organization_id, branch_org;
  END IF;

  SELECT organization_id INTO ingredient_org FROM public.ingredients WHERE id = NEW.ingredient_id;
  IF ingredient_org IS NULL THEN RAISE EXCEPTION 'Ingredient % does not exist', NEW.ingredient_id; END IF;
  IF ingredient_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Movement org (%) does not match ingredient org (%)', NEW.organization_id, ingredient_org;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER stock_movements_check_org_match
  BEFORE INSERT OR UPDATE OF branch_id, ingredient_id, organization_id ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.check_stock_movement_org_match();

-- ============================================================================
-- stock_levels (materialized per branch + ingredient)
-- ----------------------------------------------------------------------------
-- Composite primary key; a row only exists once the ingredient has had at
-- least one movement at that branch. The trigger UPSERTs it.
-- ============================================================================
CREATE TABLE public.stock_levels (
  branch_id     UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quantity      NUMERIC(12,3) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (branch_id, ingredient_id)
);

CREATE INDEX stock_levels_organization_id_idx ON public.stock_levels (organization_id);
CREATE INDEX stock_levels_ingredient_id_idx   ON public.stock_levels (ingredient_id);

COMMENT ON TABLE public.stock_levels IS
  'Materialized current quantity per (branch, ingredient). Maintained by stock_movements trigger; do not write directly.';

-- ============================================================================
-- maintain_stock_level — INS/UPD/DEL on stock_movements keeps stock_levels.
-- SECURITY DEFINER so a member registering a manual entrada/salida can
-- still cause the level row to be upserted even though they don't have
-- a direct INSERT policy on stock_levels.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.maintain_stock_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  delta NUMERIC(12,3);
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := NEW.quantity_delta;
    INSERT INTO public.stock_levels (
      branch_id, ingredient_id, organization_id, quantity, updated_at
    ) VALUES (
      NEW.branch_id, NEW.ingredient_id, NEW.organization_id, delta, now()
    )
    ON CONFLICT (branch_id, ingredient_id) DO UPDATE
      SET quantity   = public.stock_levels.quantity + EXCLUDED.quantity,
          updated_at = now();
  ELSIF TG_OP = 'UPDATE' THEN
    delta := NEW.quantity_delta - OLD.quantity_delta;
    IF delta <> 0 THEN
      INSERT INTO public.stock_levels (
        branch_id, ingredient_id, organization_id, quantity, updated_at
      ) VALUES (
        NEW.branch_id, NEW.ingredient_id, NEW.organization_id, delta, now()
      )
      ON CONFLICT (branch_id, ingredient_id) DO UPDATE
        SET quantity   = public.stock_levels.quantity + EXCLUDED.quantity,
            updated_at = now();
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Reverse the old movement
    UPDATE public.stock_levels
       SET quantity   = quantity - OLD.quantity_delta,
           updated_at = now()
     WHERE branch_id = OLD.branch_id
       AND ingredient_id = OLD.ingredient_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER stock_movements_maintain_level
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.maintain_stock_level();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.ingredients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels     ENABLE ROW LEVEL SECURITY;

-- ingredients
CREATE POLICY ingredients_select_member
  ON public.ingredients FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY ingredients_insert_manager
  ON public.ingredients FOR INSERT TO authenticated
  WITH CHECK (public.user_can_manage_org(organization_id));

CREATE POLICY ingredients_update_manager
  ON public.ingredients FOR UPDATE TO authenticated
  USING (public.user_can_manage_org(organization_id))
  WITH CHECK (public.user_can_manage_org(organization_id));

CREATE POLICY ingredients_delete_manager
  ON public.ingredients FOR DELETE TO authenticated
  USING (public.user_can_manage_org(organization_id));

-- stock_movements — managers mutate, members read. UPDATE not allowed
-- (this is an audit ledger; correct mistakes with a counter-movement).
CREATE POLICY stock_movements_select_member
  ON public.stock_movements FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY stock_movements_insert_manager
  ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (public.user_can_manage_org(organization_id));

CREATE POLICY stock_movements_delete_manager
  ON public.stock_movements FOR DELETE TO authenticated
  USING (public.user_can_manage_org(organization_id));

-- stock_levels — read only via members; no INSERT/UPDATE policy means
-- nothing other than the SECURITY DEFINER trigger can write.
CREATE POLICY stock_levels_select_member
  ON public.stock_levels FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));

-- Lock down trigger function from REST exposure
REVOKE EXECUTE ON FUNCTION public.maintain_stock_level()
  FROM PUBLIC, anon, authenticated;
