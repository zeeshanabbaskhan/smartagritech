-- CF feature tables (access groups, device groups, facilities, custom dashboards, power flow)
-- Idempotent — safe to re-run on production when tables are missing.
-- Apply: npx prisma db execute --file prisma/add_cf_features.sql
-- CapRover one-shot (from ems-backend app): npm run db:ensure-cf

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE "FacilityNodeType" AS ENUM ('ORGANIZATION','CAMPUS','SITE','BUILDING','BLOCK','WING','FLOOR','DEPARTMENT','SECTION','ROOM'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "DashboardVisibility" AS ENUM ('PRIVATE','SHARED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "access_groups" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "createdBy" TEXT REFERENCES "users"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "access_groups_organizationId_idx" ON "access_groups"("organizationId");

CREATE TABLE IF NOT EXISTS "access_group_devices" (
  "accessGroupId" TEXT NOT NULL REFERENCES "access_groups"("id") ON DELETE CASCADE,
  "deviceId" TEXT NOT NULL REFERENCES "devices"("id") ON DELETE CASCADE,
  PRIMARY KEY ("accessGroupId","deviceId")
);

CREATE TABLE IF NOT EXISTS "access_group_users" (
  "accessGroupId" TEXT NOT NULL REFERENCES "access_groups"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  PRIMARY KEY ("accessGroupId","userId")
);

CREATE TABLE IF NOT EXISTS "device_groups" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "createdBy" TEXT REFERENCES "users"("id"),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "device_groups_organizationId_idx" ON "device_groups"("organizationId");

CREATE TABLE IF NOT EXISTS "device_group_devices" (
  "deviceGroupId" TEXT NOT NULL REFERENCES "device_groups"("id") ON DELETE CASCADE,
  "deviceId" TEXT NOT NULL REFERENCES "devices"("id") ON DELETE CASCADE,
  PRIMARY KEY ("deviceGroupId","deviceId")
);

CREATE TABLE IF NOT EXISTS "device_group_users" (
  "deviceGroupId" TEXT NOT NULL REFERENCES "device_groups"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  PRIMARY KEY ("deviceGroupId","userId")
);

CREATE TABLE IF NOT EXISTS "facility_nodes" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "parentId" TEXT REFERENCES "facility_nodes"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "type" "FacilityNodeType" NOT NULL DEFAULT 'BUILDING',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "facility_nodes_organizationId_idx" ON "facility_nodes"("organizationId");
CREATE INDEX IF NOT EXISTS "facility_nodes_parentId_idx" ON "facility_nodes"("parentId");

CREATE TABLE IF NOT EXISTS "custom_dashboards" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "ownerUserId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "visibility" "DashboardVisibility" NOT NULL DEFAULT 'PRIVATE',
  "context" JSONB NOT NULL DEFAULT '{}',
  "layout" JSONB NOT NULL DEFAULT '[]',
  "widgets" JSONB NOT NULL DEFAULT '[]',
  "targetDeviceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "custom_dashboards_organizationId_idx" ON "custom_dashboards"("organizationId");
CREATE INDEX IF NOT EXISTS "custom_dashboards_ownerUserId_idx" ON "custom_dashboards"("ownerUserId");

CREATE TABLE IF NOT EXISTS "power_flow_configs" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "sources" JSONB NOT NULL DEFAULT '[]',
  "savings" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "facility_node_devices" (
  "facilityNodeId" TEXT NOT NULL REFERENCES "facility_nodes"("id") ON DELETE CASCADE,
  "deviceId" TEXT NOT NULL REFERENCES "devices"("id") ON DELETE CASCADE,
  PRIMARY KEY ("facilityNodeId","deviceId")
);
CREATE INDEX IF NOT EXISTS "facility_node_devices_deviceId_idx" ON "facility_node_devices"("deviceId");
