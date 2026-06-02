-- Migration 001: extensions and utility functions
-- Foundation primitives reused by every downstream migration.

-- gen_random_uuid() lives in pgcrypto. Available in Supabase by default
-- but we declare the dependency explicitly so this file is self-contained.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Generic trigger function to maintain updated_at on row updates.
-- Each table that needs it wires its own BEFORE UPDATE trigger.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Sets updated_at = now() on row update. Attach via BEFORE UPDATE trigger.';
