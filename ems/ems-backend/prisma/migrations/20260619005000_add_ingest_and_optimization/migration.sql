-- Add columns/tables introduced after init migration (ingest auth, commands, reading values)

DO $$ BEGIN
  CREATE TYPE "CommandStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'FAILED', 'TIMEOUT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

DO $$ BEGIN
  ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "ingestApiKeyHash" TEXT;

CREATE TABLE IF NOT EXISTS "device_commands" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "CommandStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "failedReason" TEXT,

    CONSTRAINT "device_commands_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "device_commands_deviceId_status_idx" ON "device_commands"("deviceId", "status");
CREATE INDEX IF NOT EXISTS "device_commands_organizationId_requestedAt_idx" ON "device_commands"("organizationId", "requestedAt");

DO $$ BEGIN
  ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "sensor_reading_values" (
    "id" TEXT NOT NULL,
    "sensorReadingId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceConfigSlaveId" TEXT,
    "organizationId" TEXT NOT NULL,
    "variableName" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sensor_reading_values_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sensor_reading_values_deviceId_variableName_timestamp_idx"
  ON "sensor_reading_values"("deviceId", "variableName", "timestamp");
CREATE INDEX IF NOT EXISTS "sensor_reading_values_deviceId_timestamp_idx"
  ON "sensor_reading_values"("deviceId", "timestamp");
CREATE INDEX IF NOT EXISTS "sensor_reading_values_organizationId_timestamp_idx"
  ON "sensor_reading_values"("organizationId", "timestamp");
