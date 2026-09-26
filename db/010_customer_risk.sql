-- Phase 4: customer risk-factor inputs. Nationality and delivery channel feed the risk matrix
-- (alongside country of residence and industry). Empty string = not provided.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS nationality text NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_channel text NOT NULL DEFAULT '';
