-- CreateEnum
CREATE TYPE "GatewayStatus" AS ENUM (
  'ONLINE',
  'OFFLINE',
  'UPGRADING',
  'IN_CONFIGURATION',
  'GATEWAY_ALARM',
  'DISABLED'
);

-- AlterTable: move gateways.status from DeviceStatus → GatewayStatus
ALTER TABLE "gateways" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "gateways"
  ALTER COLUMN "status" TYPE "GatewayStatus"
  USING ("status"::text::"GatewayStatus");
ALTER TABLE "gateways" ALTER COLUMN "status" SET DEFAULT 'OFFLINE'::"GatewayStatus";
