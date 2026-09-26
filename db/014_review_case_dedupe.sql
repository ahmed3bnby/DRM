-- 014: one active review case per customer.
-- 013 backfilled one review case per relevant screening, so a customer screened
-- more than once ended up with several open cases in the queue (the same name
-- repeated). Collapse them to a single active case per customer, preferring an
-- assigned case, otherwise the one tied to the newest screening, then enforce
-- the invariant going forward. Evidence and decisions stay in the screening
-- tables; only the redundant workflow pointers are removed.
WITH ranked AS (
  SELECT rc.id,
    row_number() OVER (
      PARTITION BY rc.customer_id
      ORDER BY (rc.assigned_to IS NOT NULL) DESC, s.created_at DESC, rc.created_at DESC
    ) AS rn
  FROM review_cases rc
  JOIN customer_screenings s ON s.id = rc.screening_id
  WHERE rc.status <> 'resolved'
)
DELETE FROM review_cases WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS review_cases_one_active_per_customer
  ON review_cases(customer_id) WHERE status <> 'resolved';
