-- Migration 011: enable Supabase Realtime on orders + order_items
--
-- Supabase ships a publication named `supabase_realtime` that the
-- realtime service reads from. To let the browser subscribe to
-- postgres_changes on a table, the table has to be a member of that
-- publication. RLS still applies on subscription, so the kitchen sees
-- only their org's changes — no extra access checks needed here.

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
