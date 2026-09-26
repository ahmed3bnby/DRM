-- Allow graceful cleanup when an admin deletes a team member
ALTER TABLE audit_events ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_actor_id_fkey;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE customer_screenings ALTER COLUMN run_by DROP NOT NULL;
ALTER TABLE customer_screenings DROP CONSTRAINT IF EXISTS customer_screenings_run_by_fkey;
ALTER TABLE customer_screenings ADD CONSTRAINT customer_screenings_run_by_fkey
  FOREIGN KEY (run_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE match_decisions ALTER COLUMN decided_by DROP NOT NULL;
ALTER TABLE match_decisions DROP CONSTRAINT IF EXISTS match_decisions_decided_by_fkey;
ALTER TABLE match_decisions ADD CONSTRAINT match_decisions_decided_by_fkey
  FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE customers ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_created_by_fkey;
ALTER TABLE customers ADD CONSTRAINT customers_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

GRANT UPDATE, DELETE ON audit_events TO mizan_app;
GRANT UPDATE ON customer_screenings TO mizan_app;
GRANT UPDATE ON match_decisions TO mizan_app;
