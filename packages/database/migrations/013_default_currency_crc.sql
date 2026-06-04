-- Migration 013: set default currency to CRC (Costa Rican colón)
--
-- Until now organizations.currency defaulted to 'USD' to be safe. The
-- product is rolling out in Costa Rica, so CRC is the right default for
-- new restaurants. Existing rows keep their currency unless they're
-- still on the legacy 'USD' default — those get migrated.

ALTER TABLE public.organizations
  ALTER COLUMN currency SET DEFAULT 'CRC';

-- Update existing rows that look like the default-USD case so the
-- already-onboarded restaurants get their localized currency too.
UPDATE public.organizations
   SET currency = 'CRC'
 WHERE currency = 'USD';
