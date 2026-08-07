-- AlterEnum: dual-threshold operators for alarm templates
DO $$ BEGIN
  ALTER TYPE "Operator" ADD VALUE 'BETWEEN';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "Operator" ADD VALUE 'OUTSIDE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: optional upper/second threshold (B)
ALTER TABLE "template_triggers" ADD COLUMN IF NOT EXISTS "thresholdB" DOUBLE PRECISION;
