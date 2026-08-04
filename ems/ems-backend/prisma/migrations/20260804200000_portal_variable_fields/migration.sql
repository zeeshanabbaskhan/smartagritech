-- Portal parity: slave protocol + full variable metadata fields

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "VariableType" AS ENUM ('DIRECT', 'EQUATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: device_template_slaves
ALTER TABLE "device_template_slaves" ADD COLUMN IF NOT EXISTS "protocol" TEXT;

-- AlterTable: device_template_variables
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "sortNumber" INTEGER;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "identifier" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "machineId" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "machineControl" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "iconLabel" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "lineChartColor" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "lineChartLimit" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "lowLimitLineChart" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "peakTimeStart" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "peakTimeEnd" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "peakOffTimeStart" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "peakOffTimeEnd" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "peakTimeColor" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "peakOffTimeColor" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "variableType" "VariableType" NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "registerFuncCode" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "dataFormat" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "numberFormat" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "decimalPlacesPadding" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "storageVariable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "storageTiming" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "readWrite" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "acquisitionFormula" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "controlFormula" TEXT;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "mainPageSelection" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "defaultUnitSelection" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "device_template_variables" ADD COLUMN IF NOT EXISTS "equationSlaveIds" JSONB;
