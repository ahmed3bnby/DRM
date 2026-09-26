-- Phase (Idenfo parity): store the adverse-media scan taken at screening time with the screening,
-- so the profile/report shows an "Adverse media" result tied to that run. NULL = not captured.
ALTER TABLE customer_screenings ADD COLUMN IF NOT EXISTS adverse_media jsonb;
