-- 018: restore audit-log immutability.
-- The account-deletion work granted UPDATE/DELETE on audit_events and made its
-- foreign keys ON DELETE SET NULL, so deleting a customer or user mutated the
-- audit trail. For an AML/compliance system the audit log must be append-only.
--
-- Fix: drop the FK coupling (audit rows keep the original actor/customer id
-- forever as an immutable snapshot, even after the referenced row is deleted),
-- and take back every privilege except SELECT/INSERT from the app role.
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_actor_id_fkey;
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_customer_id_fkey;

REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM mizan_app;
GRANT SELECT, INSERT ON audit_events TO mizan_app;
