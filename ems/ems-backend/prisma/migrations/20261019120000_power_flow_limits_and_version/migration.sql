-- AlterTable: executiveLimits and version for power_flow_configs
ALTER TABLE "power_flow_configs" ADD COLUMN IF NOT EXISTS "executiveLimits" JSONB DEFAULT '{}';
ALTER TABLE "power_flow_configs" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
UPDATE "power_flow_configs" SET "version" = 1 WHERE "version" IS NULL;
UPDATE "power_flow_configs" SET "executiveLimits" = '{}'::jsonb WHERE "executiveLimits" IS NULL;
