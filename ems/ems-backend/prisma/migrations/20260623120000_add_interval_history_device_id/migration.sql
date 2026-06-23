-- Adds IntervalHistory.deviceId (nullable) + FK. The column was added to the
-- Prisma schema without a matching migration, causing:
--   "The column interval_histories.deviceId does not exist in the current database."
-- Matches schema: device Device? @relation(fields: [deviceId], references: [id], onDelete: SetNull)

ALTER TABLE "interval_histories" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'interval_histories_deviceId_fkey'
  ) THEN
    ALTER TABLE "interval_histories"
      ADD CONSTRAINT "interval_histories_deviceId_fkey"
      FOREIGN KEY ("deviceId") REFERENCES "devices"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
