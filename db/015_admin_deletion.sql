-- Allow mizan_app to delete records when an admin explicitly performs a deletion
GRANT DELETE ON customers TO mizan_app;
GRANT DELETE ON customer_screenings TO mizan_app;
GRANT DELETE ON match_decisions TO mizan_app;
GRANT DELETE ON review_cases TO mizan_app;
GRANT DELETE ON search_events TO mizan_app;

-- For audit_events, if customer is deleted, set customer_id to null so the audit history is preserved
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_customer_id_fkey;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
