-- MQTT bridge table (idempotent)
CREATE TABLE IF NOT EXISTS "mqtt_bridges" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'MQTT Bridge',
    "brokerHost" TEXT NOT NULL,
    "brokerPort" INTEGER NOT NULL DEFAULT 1883,
    "username" TEXT,
    "password" TEXT,
    "subscribeTopic" TEXT NOT NULL DEFAULT '/UploadTopic',
    "commandTopic" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'STOPPED',
    "lastError" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "messagesReceived" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mqtt_bridges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "mqtt_bridges_organizationId_idx" ON "mqtt_bridges"("organizationId");

DO $$ BEGIN
  ALTER TABLE "mqtt_bridges"
    ADD CONSTRAINT "mqtt_bridges_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
