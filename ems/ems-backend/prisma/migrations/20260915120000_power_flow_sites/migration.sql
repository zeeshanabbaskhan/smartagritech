-- AlterTable: hierarchical site support for power flow
ALTER TABLE "power_flow_configs" ADD COLUMN "sites" JSONB NOT NULL DEFAULT '[]';
