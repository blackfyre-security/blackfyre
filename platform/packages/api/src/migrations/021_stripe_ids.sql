-- ============================================================================
-- 021_stripe_ids.sql  (ported from launch-blockers/w1-w4 017_stripe_ids.sql)
-- ============================================================================
-- Adds Stripe customer and subscription tracking columns to the tenants table.
-- These are nullable — existing tenants that pay via Razorpay will have NULLs.
-- Stripe columns are populated by the payments-stripe.ts route on first
-- Checkout Session creation and on webhook events.
-- ============================================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE INDEX IF NOT EXISTS tenants_stripe_customer_id_idx
  ON tenants (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN tenants.stripe_customer_id     IS 'Stripe Customer ID (cus_xxx). NULL for Razorpay-only tenants.';
COMMENT ON COLUMN tenants.stripe_subscription_id IS 'Stripe Subscription ID (sub_xxx). NULL until first Stripe checkout completes.';
