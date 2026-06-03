-- Migration 010: orders + order_items + order_status_history with FSM
--
-- Three tables that model the operational heart of the POS:
--   orders               header (table, waiter, status, totals)
--   order_items          line items (snapshot product name + price)
--   order_status_history immutable audit of every status transition
--
-- Domain triggers:
--   1. orders_assign_number        BEFORE INSERT — sequential per-branch order_number
--   2. orders_validate_transition  BEFORE UPDATE OF status — enforces the FSM
--   3. orders_record_history       AFTER UPDATE OF status — appends history row
--   4. order_items_recalc_totals   AFTER INS/UPD/DEL — recomputes order subtotal/total
--
-- RLS: any active member SELECTs/INSERTs/UPDATEs; only managers DELETE.
-- (Waiters create orders + add items, kitchen transitions status, etc.)

-- ============================================================================
-- orders
-- ============================================================================
CREATE TABLE public.orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  table_id        UUID REFERENCES public.tables(id) ON DELETE RESTRICT,
  waiter_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  order_number    INTEGER NOT NULL,       -- assigned by trigger, sequential per branch
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','preparing','ready','delivered','paid','cancelled')),

  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),

  notes           TEXT CHECK (notes IS NULL OR length(notes) <= 1000),

  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at        TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT orders_branch_number_unique UNIQUE (branch_id, order_number)
);

CREATE INDEX orders_organization_id_idx ON public.orders (organization_id);
CREATE INDEX orders_branch_id_idx       ON public.orders (branch_id);
CREATE INDEX orders_table_id_idx        ON public.orders (table_id) WHERE table_id IS NOT NULL;
CREATE INDEX orders_waiter_id_idx       ON public.orders (waiter_user_id);

-- Hot path: list active orders (anything not paid/cancelled) for a branch.
CREATE INDEX orders_branch_status_idx
  ON public.orders (branch_id, status, opened_at DESC)
  WHERE status NOT IN ('paid', 'cancelled');

-- Reports: paid orders ordered by paid_at.
CREATE INDEX orders_branch_paid_at_idx
  ON public.orders (branch_id, paid_at DESC)
  WHERE status = 'paid';

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.orders IS
  'POS order header. Status FSM enforced by trigger. Totals auto-recalc from items.';

-- ============================================================================
-- order_items
-- ----------------------------------------------------------------------------
-- product_name_snapshot + unit_price are captured at item-creation time so
-- that historical orders remain stable even if the product is renamed or
-- repriced later. organization_id is denormalized to keep RLS simple.
-- ============================================================================
CREATE TABLE public.order_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id            UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,

  product_name_snapshot TEXT NOT NULL CHECK (length(product_name_snapshot) BETWEEN 1 AND 160),
  unit_price            NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity              INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 999),

  -- Stored generated column: always (unit_price * quantity). Indexable and
  -- referenced by the order-totals trigger.
  line_total            NUMERIC(12,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,

  notes                 TEXT CHECK (notes IS NULL OR length(notes) <= 500),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX order_items_order_id_idx        ON public.order_items (order_id);
CREATE INDEX order_items_organization_id_idx ON public.order_items (organization_id);
CREATE INDEX order_items_product_id_idx      ON public.order_items (product_id);

CREATE TRIGGER order_items_set_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.order_items IS
  'Order line items. Name/price snapshotted at add time so history stays stable.';

-- ============================================================================
-- order_status_history (immutable audit log)
-- ============================================================================
CREATE TABLE public.order_status_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_status         TEXT NOT NULL,
  to_status           TEXT NOT NULL,
  changed_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes               TEXT CHECK (notes IS NULL OR length(notes) <= 500)
);

CREATE INDEX order_status_history_order_id_idx
  ON public.order_status_history (order_id, changed_at DESC);

COMMENT ON TABLE public.order_status_history IS
  'Append-only audit of every order status transition.';

-- ============================================================================
-- Integrity guard: order.organization_id MUST match branch + table org
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_order_org_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  branch_org UUID;
  table_org  UUID;
BEGIN
  SELECT organization_id INTO branch_org FROM public.branches WHERE id = NEW.branch_id;
  IF branch_org IS NULL THEN
    RAISE EXCEPTION 'Branch % does not exist', NEW.branch_id;
  END IF;
  IF branch_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Order org (%) does not match branch org (%)', NEW.organization_id, branch_org;
  END IF;

  IF NEW.table_id IS NOT NULL THEN
    SELECT organization_id INTO table_org FROM public.tables WHERE id = NEW.table_id;
    IF table_org IS NULL THEN
      RAISE EXCEPTION 'Table % does not exist', NEW.table_id;
    END IF;
    IF table_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'Order org (%) does not match table org (%)', NEW.organization_id, table_org;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_check_org_match
  BEFORE INSERT OR UPDATE OF branch_id, table_id, organization_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.check_order_org_match();

-- ============================================================================
-- Same guard for order_items: item.organization_id MUST match order's
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_order_item_org_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  order_org   UUID;
  product_org UUID;
BEGIN
  SELECT organization_id INTO order_org FROM public.orders WHERE id = NEW.order_id;
  IF order_org IS NULL THEN
    RAISE EXCEPTION 'Order % does not exist', NEW.order_id;
  END IF;
  IF order_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'OrderItem org (%) does not match order org (%)', NEW.organization_id, order_org;
  END IF;

  SELECT organization_id INTO product_org FROM public.products WHERE id = NEW.product_id;
  IF product_org IS NULL THEN
    RAISE EXCEPTION 'Product % does not exist', NEW.product_id;
  END IF;
  IF product_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'OrderItem org (%) does not match product org (%)', NEW.organization_id, product_org;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER order_items_check_org_match
  BEFORE INSERT OR UPDATE OF order_id, product_id, organization_id ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.check_order_item_org_match();

-- ============================================================================
-- assign_order_number — set order_number sequentially per branch on insert.
-- Naive max+1 with the UNIQUE constraint as the safety net; concurrent
-- inserts to the same branch will fail the second one (caller can retry).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = 0 THEN
    SELECT COALESCE(MAX(order_number), 0) + 1
      INTO NEW.order_number
      FROM public.orders
     WHERE branch_id = NEW.branch_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_assign_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();

-- ============================================================================
-- validate_order_status_transition — enforce the allowed FSM edges.
-- Mirrors the canTransition map in @restaurant/shared/types/order-status.ts.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'open'      AND NEW.status IN ('preparing', 'cancelled')) OR
    (OLD.status = 'preparing' AND NEW.status IN ('ready', 'cancelled')) OR
    (OLD.status = 'ready'     AND NEW.status = 'delivered') OR
    (OLD.status = 'delivered' AND NEW.status = 'paid')
  ) THEN
    RAISE EXCEPTION 'Invalid order status transition: % -> %', OLD.status, NEW.status;
  END IF;

  -- Stamp the lifecycle timestamps as we transition.
  IF NEW.status = 'ready'     AND NEW.ready_at     IS NULL THEN NEW.ready_at     := now(); END IF;
  IF NEW.status = 'delivered' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF;
  IF NEW.status = 'paid'      AND NEW.paid_at      IS NULL THEN NEW.paid_at      := now(); END IF;
  IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN NEW.cancelled_at := now(); END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_validate_transition
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_status_transition();

-- ============================================================================
-- record_order_status_history — append to the audit log on every transition.
-- AFTER trigger so we know the row was actually written.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_order_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- bypasses RLS on order_status_history insert
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (
      order_id, organization_id, from_status, to_status, changed_by_user_id
    ) VALUES (
      NEW.id, NEW.organization_id, OLD.status, NEW.status, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_record_status_history
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_order_status_history();

-- ============================================================================
-- recalc_order_totals — on item INSERT/UPDATE/DELETE, recompute the order's
-- subtotal and total. Cheap: SUM over rows for this order.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalc_order_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- bypasses RLS so any member adding items recalcs the parent
SET search_path = public, pg_temp
AS $$
DECLARE
  target_order_id UUID;
  new_subtotal    NUMERIC(12,2);
BEGIN
  -- TG_OP DELETE sees the row in OLD; INSERT/UPDATE in NEW.
  IF TG_OP = 'DELETE' THEN
    target_order_id := OLD.order_id;
  ELSE
    target_order_id := NEW.order_id;
  END IF;

  SELECT COALESCE(SUM(line_total), 0)
    INTO new_subtotal
    FROM public.order_items
   WHERE order_id = target_order_id;

  UPDATE public.orders
     SET subtotal = new_subtotal,
         total    = new_subtotal - discount_amount + tax_amount
   WHERE id = target_order_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER order_items_recalc_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_order_totals();

-- ============================================================================
-- RLS — members read + write, only managers delete orders.
-- ============================================================================
ALTER TABLE public.orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- orders
CREATE POLICY orders_select_member
  ON public.orders
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY orders_insert_member
  ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY orders_update_member
  ON public.orders
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY orders_delete_manager
  ON public.orders
  FOR DELETE TO authenticated
  USING (public.user_can_manage_org(organization_id));

-- order_items
CREATE POLICY order_items_select_member
  ON public.order_items
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY order_items_insert_member
  ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY order_items_update_member
  ON public.order_items
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY order_items_delete_member
  ON public.order_items
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));

-- order_status_history — read for members, no direct writes (trigger only)
CREATE POLICY order_status_history_select_member
  ON public.order_status_history
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));

-- Lock down the trigger function so anon can't poke it via PostgREST
REVOKE EXECUTE ON FUNCTION public.record_order_status_history()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_order_totals()
  FROM PUBLIC, anon, authenticated;
