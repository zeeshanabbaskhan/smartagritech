-- Manual migration for optimization v3.1 (run if prisma db push fails on Timescale hypertable PK)

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS refresh_tokens_userId_idx ON refresh_tokens("userId");

ALTER TABLE devices ADD COLUMN IF NOT EXISTS "ingestApiKeyHash" TEXT;

CREATE TABLE IF NOT EXISTS device_commands (
  id TEXT PRIMARY KEY,
  "deviceId" TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  "organizationId" TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "requestedBy" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "failedReason" TEXT
);
CREATE INDEX IF NOT EXISTS device_commands_deviceId_status_idx ON device_commands("deviceId", status);
CREATE INDEX IF NOT EXISTS device_commands_organizationId_requestedAt_idx ON device_commands("organizationId", "requestedAt");

CREATE TABLE IF NOT EXISTS sensor_reading_values (
  id TEXT PRIMARY KEY,
  "sensorReadingId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "deviceConfigSlaveId" TEXT,
  "organizationId" TEXT NOT NULL,
  "variableName" TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS sensor_reading_values_deviceId_variableName_timestamp_idx
  ON sensor_reading_values("deviceId", "variableName", timestamp);
CREATE INDEX IF NOT EXISTS sensor_reading_values_deviceId_timestamp_idx
  ON sensor_reading_values("deviceId", timestamp);
CREATE INDEX IF NOT EXISTS sensor_reading_values_organizationId_timestamp_idx
  ON sensor_reading_values("organizationId", timestamp);
