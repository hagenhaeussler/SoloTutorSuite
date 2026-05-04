-- SoloTutorSuite: allow one-time subscription/payment offers

ALTER TABLE mock_subscriptions
  DROP CONSTRAINT IF EXISTS mock_subscriptions_billing_interval_check;

ALTER TABLE mock_subscriptions
  ADD CONSTRAINT mock_subscriptions_billing_interval_check
  CHECK (billing_interval IN ('once', 'weekly', 'monthly', 'yearly'));
