-- Migration 016: Add raw_query column to search_events to store human-readable search queries
ALTER TABLE search_events ADD COLUMN IF NOT EXISTS raw_query text;
CREATE INDEX IF NOT EXISTS search_events_user_recent ON search_events(user_id, created_at DESC);

-- Grant UPDATE permission to application role
GRANT UPDATE ON search_events TO mizan_app;
