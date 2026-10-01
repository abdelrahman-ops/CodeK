DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PaymentWebhookEvent') THEN
    DROP INDEX IF EXISTS "PaymentWebhookEvent_provider_eventId_idx";
    CREATE UNIQUE INDEX IF NOT EXISTS "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");
  END IF;
END $$;
