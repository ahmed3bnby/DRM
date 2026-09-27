-- Migration 022: Login rate limiting and failed attempts cleanup
-- Grant DELETE on login_attempts so the application can clear failed attempts upon successful authentication
GRANT SELECT, INSERT, DELETE ON login_attempts TO mizan_app;
