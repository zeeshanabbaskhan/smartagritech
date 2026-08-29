-- Register labels + formulas (conflict-safe, idempotent).
-- Run as single script; avoids duplicate (templateSlaveId, name) violations.

-- ── Registers with no name collision: set friendly name ──
UPDATE device_template_variables tv
SET name = 'ActivePower', "displayName" = 'Active Power', unit = 'W'
WHERE tv."registerAddress" = '40115' AND tv.name LIKE 'R40115%';

UPDATE device_template_variables tv
SET name = 'ReactivePower', "displayName" = 'Reactive Power', unit = 'VAr'
WHERE tv."registerAddress" = '40123' AND tv.name LIKE 'R40123%';

UPDATE device_template_variables tv
SET name = 'ApparentPower', "displayName" = 'Apparent Power', unit = 'VA'
WHERE tv."registerAddress" = '40131' AND tv.name LIKE 'R40131%';

UPDATE device_template_variables tv
SET name = 'ExportPower', "displayName" = 'Export Power', unit = 'kWh'
WHERE tv."registerAddress" = '40141' AND tv.name LIKE 'R40141%';

-- ── Voltage 40103/40105/40107: rename when free, else unique alias ──
UPDATE device_template_variables tv
SET name = 'VoltageA', "displayName" = 'Voltage Phase A', unit = 'V'
WHERE tv."registerAddress" = '40103'
  AND NOT EXISTS (
    SELECT 1 FROM device_template_variables o
    WHERE o."templateSlaveId" = tv."templateSlaveId" AND o.name = 'VoltageA' AND o.id <> tv.id
  );

UPDATE device_template_variables tv
SET name = 'VoltageA40103', "displayName" = 'Voltage Phase A', unit = 'V'
WHERE tv."registerAddress" = '40103' AND tv.name LIKE 'R40103%';

UPDATE device_template_variables tv
SET name = 'VoltageB', "displayName" = 'Voltage Phase B', unit = 'V'
WHERE tv."registerAddress" = '40105'
  AND NOT EXISTS (
    SELECT 1 FROM device_template_variables o
    WHERE o."templateSlaveId" = tv."templateSlaveId" AND o.name = 'VoltageB' AND o.id <> tv.id
  );

UPDATE device_template_variables tv
SET name = 'VoltageB40105', "displayName" = 'Voltage Phase B', unit = 'V'
WHERE tv."registerAddress" = '40105' AND tv.name LIKE 'R40105%';

UPDATE device_template_variables tv
SET name = 'VoltageC', "displayName" = 'Voltage Phase C', unit = 'V'
WHERE tv."registerAddress" = '40107'
  AND NOT EXISTS (
    SELECT 1 FROM device_template_variables o
    WHERE o."templateSlaveId" = tv."templateSlaveId" AND o.name = 'VoltageC' AND o.id <> tv.id
  );

UPDATE device_template_variables tv
SET name = 'VoltageC40107', "displayName" = 'Voltage Phase C', unit = 'V'
WHERE tv."registerAddress" = '40107' AND tv.name LIKE 'R40107%';

-- ── Power factor: Scale / R40081 / 40137 ──
UPDATE device_template_variables tv
SET name = 'PowerFactor', "displayName" = 'Power Factor', unit = ''
WHERE tv."registerAddress" = '40084' AND tv.name = 'Scale'
  AND NOT EXISTS (
    SELECT 1 FROM device_template_variables o
    WHERE o."templateSlaveId" = tv."templateSlaveId" AND o.name = 'PowerFactor' AND o.id <> tv.id
  );

UPDATE device_template_variables tv
SET name = 'PowerFactor', "displayName" = 'Power Factor', unit = ''
WHERE tv."registerAddress" = '40084' AND tv.name = 'Power Factor';

UPDATE device_template_variables tv
SET name = 'PowerFactor40084', "displayName" = 'Power Factor', unit = ''
WHERE tv."registerAddress" = '40084' AND tv.name = 'Scale';

UPDATE device_template_variables tv
SET name = 'PowerFactor', "displayName" = 'Power Factor', unit = ''
WHERE tv."registerAddress" = '40081' AND tv.name = 'R40081'
  AND NOT EXISTS (
    SELECT 1 FROM device_template_variables o
    WHERE o."templateSlaveId" = tv."templateSlaveId" AND o.name = 'PowerFactor' AND o.id <> tv.id
  );

UPDATE device_template_variables tv
SET name = 'PowerFactor40081', "displayName" = 'Power Factor', unit = ''
WHERE tv."registerAddress" = '40081' AND tv.name = 'R40081';

UPDATE device_template_variables tv
SET "displayName" = 'Power Factor', unit = ''
WHERE tv."registerAddress" = '40137' AND tv.name = 'PowerFactor';

-- ── Formulas (skip rows with controlFormula set) ──
UPDATE device_template_variables
SET "acquisitionFormula" = '=s/100'
WHERE "registerAddress" = '40085'
  AND COALESCE(NULLIF(TRIM("controlFormula"), ''), NULL) IS NULL;

UPDATE device_template_variables
SET "acquisitionFormula" = '=s/1000'
WHERE (
    "registerAddress" IN ('40081', '40084', '40137')
    OR name ILIKE 'powerfactor%'
    OR "displayName" ILIKE 'power factor%'
  )
  AND COALESCE(NULLIF(TRIM("controlFormula"), ''), NULL) IS NULL;

-- ── Sync device config labels from template ──
UPDATE device_config_variables cv
SET name = tv.name,
    "displayName" = tv."displayName",
    unit = tv.unit
FROM device_template_variables tv
WHERE cv."templateVariableId" = tv.id
  AND tv."registerAddress" IN (
    '40081', '40084', '40085', '40103', '40105', '40107',
    '40115', '40123', '40131', '40137', '40141'
  );
