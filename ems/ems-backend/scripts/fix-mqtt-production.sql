-- Read-only safe idempotent fixes for smartagritech Postgres (MQTT pipeline).
-- 1) Scale Modbus frequency register 40085 (raw ~5000 → ~50 Hz)

UPDATE device_template_variables
SET "acquisitionFormula" = '=s/100'
WHERE "registerAddress" = '40085'
  AND (
    name ILIKE '%frequency%'
    OR name = 'Frequency'
  )
  AND COALESCE(NULLIF(TRIM("acquisitionFormula"), ''), NULL) IS NULL
  AND COALESCE(NULLIF(TRIM("controlFormula"), ''), NULL) IS NULL;

-- 2) FICOEV: default dashboard slave = FicoInverter (avoids InverterMain/charger mix-up)
UPDATE device_config_slaves SET "isDefault" = false
WHERE "deviceId" = '124c2d15-9614-4dcb-967c-1971f393b23d';
UPDATE device_config_slaves SET "isDefault" = true
WHERE id = '9937188f-eeed-414a-b134-f8d4d890c2f1';
