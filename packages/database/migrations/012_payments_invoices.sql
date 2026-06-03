-- Migration 012: payments + invoices with auto-paid + auto-invoice triggers
--
-- payments  N:1 to orders. Supports split bills (multiple rows per order).
-- invoices  1:1 with orders, fiscal document, never deleted.
--
-- Domain triggers:
--   1. payments_auto_paid       AFTER INS/UPD/DEL — if order is delivered
--                               and sum(payments) >= order.total, move to paid.
--   2. orders_auto_invoice      AFTER UPDATE OF status — when an order
--                               transitions to 'paid', create an invoice
--                               with sequential invoice_number per org.
--
-- RLS:
--   payments  members SELECT/INSERT/UPDATE, managers DELETE
--   invoices  members SELECT only (writes via trigger or PATCH for customer)
--             managers UPDATE the customer fields

-- ============================================================================
-- payments
-- ============================================================================
CREATE TABLE public.payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id             UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,

  method               TEXT NOT NULL
                         CHECK (method IN ('cash','card','transfer','other')),
  amount               NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference            TEXT CHECK (reference IS NULL OR length(reference) <= 120),

  received_by_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_organization_id_idx ON public.payments (organization_id);
CREATE INDEX payments_order_id_idx        ON public.payments (order_id);

CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.payments IS
  'Payments received against an order. Supports split bills (N rows per order).';

-- Org-match guard
CREATE OR REPLACE FUNCTION public.check_payment_org_match()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE order_org UUID;
BEGIN
  SELECT organization_id INTO order_org FROM public.orders WHERE id = NEW.order_id;
  IF order_org IS NULL THEN RAISE EXCEPTION 'Order % does not exist', NEW.order_id; END IF;
  IF order_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Payment org (%) does not match order org (%)', NEW.organization_id, order_org;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER payments_check_org_match
  BEFORE INSERT OR UPDATE OF order_id, organization_id ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.check_payment_org_match();

-- ============================================================================
-- invoices — fiscal document, 1:1 with order
-- ============================================================================
CREATE TABLE public.invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id         UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,

  invoice_number   INTEGER NOT NULL,           -- sequential per org

  customer_name    TEXT CHECK (customer_name IS NULL OR length(customer_name) <= 200),
  customer_tax_id  TEXT CHECK (customer_tax_id IS NULL OR length(customer_tax_id) <= 40),

  -- Snapshots at issue time so renaming the org / repricing later doesn't
  -- mutate the fiscal record.
  subtotal         NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount  NUMERIC(12,2) NOT NULL CHECK (discount_amount >= 0),
  tax_amount       NUMERIC(12,2) NOT NULL CHECK (tax_amount >= 0),
  total            NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  currency         TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),

  issued_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT invoices_org_number_unique UNIQUE (organization_id, invoice_number)
);

CREATE INDEX invoices_organization_id_idx ON public.invoices (organization_id);
CREATE INDEX invoices_order_id_idx        ON public.invoices (order_id);

CREATE TRIGGER invoices_set_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.invoices IS
  'Fiscal invoice document. Generated automatically when an order is paid. Immutable totals.';

-- ============================================================================
-- payments_auto_paid — if order is delivered and sum >= total, mark paid.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.payments_auto_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_order_id UUID;
  order_total     NUMERIC(12,2);
  order_status    TEXT;
  paid_total      NUMERIC(12,2);
BEGIN
  IF TG_OP = 'DELETE' THEN target_order_id := OLD.order_id;
  ELSE target_order_id := NEW.order_id; END IF;

  SELECT status, total INTO order_status, order_total
    FROM public.orders WHERE id = target_order_id;
  IF order_status IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Only auto-progress from delivered. From earlier statuses the waiter
  -- still needs to send-to-cocina/mark-ready/mark-delivered first.
  IF order_status <> 'delivered' THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT COALESCE(SUM(amount), 0) INTO paid_total
    FROM public.payments WHERE order_id = target_order_id;

  IF paid_total >= order_total THEN
    UPDATE public.orders SET status = 'paid' WHERE id = target_order_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER payments_auto_paid_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payments_auto_paid();

-- ============================================================================
-- orders_auto_invoice — when status → 'paid', generate the invoice row
-- with the next sequential invoice_number for this organization.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.orders_auto_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_number INT;
  org_currency TEXT;
BEGIN
  IF NEW.status = 'paid' AND OLD.status <> 'paid' THEN
    -- Skip if an invoice already exists (defensive — UNIQUE would catch it).
    IF EXISTS (SELECT 1 FROM public.invoices WHERE order_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(invoice_number), 0) + 1 INTO next_number
      FROM public.invoices WHERE organization_id = NEW.organization_id;

    SELECT currency INTO org_currency
      FROM public.organizations WHERE id = NEW.organization_id;

    INSERT INTO public.invoices (
      organization_id, order_id, invoice_number,
      subtotal, discount_amount, tax_amount, total, currency
    ) VALUES (
      NEW.organization_id, NEW.id, next_number,
      NEW.subtotal, NEW.discount_amount, NEW.tax_amount, NEW.total, org_currency
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER orders_auto_invoice_trigger
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_auto_invoice();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_select_member
  ON public.payments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY payments_insert_member
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY payments_update_member
  ON public.payments FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY payments_delete_manager
  ON public.payments FOR DELETE TO authenticated
  USING (public.user_can_manage_org(organization_id));

CREATE POLICY invoices_select_member
  ON public.invoices FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_org_ids()));

-- INSERT is trigger-only (no policy at all means no client INSERTs).
-- UPDATE only customer fields, and only by managers.
CREATE POLICY invoices_update_manager
  ON public.invoices FOR UPDATE TO authenticated
  USING (public.user_can_manage_org(organization_id))
  WITH CHECK (public.user_can_manage_org(organization_id));

-- Lock down trigger functions
REVOKE EXECUTE ON FUNCTION public.payments_auto_paid()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orders_auto_invoice()
  FROM PUBLIC, anon, authenticated;
