-- Fleet-wide register labels: human displayName + clean internal names.
-- Idempotent; safe to re-run. Syncs device_config_variables from templates.

-- ── 1) Free name conflicts: 40137 is Apparent Power on meters that also have 40084 PF ──
UPDATE device_template_variables
SET name = 'ApparentPower', "displayName" = 'Apparent Power', unit = 'VA'
WHERE "registerAddress" = '40137'
  AND name IN ('PowerFactor', 'R40137');

-- ── 2) Power factor registers ──
UPDATE device_template_variables
SET name = 'PowerFactor', "displayName" = 'Power Factor', unit = ''
WHERE "registerAddress" IN ('40081', '40084')
  AND name IN ('PowerFactor40084', 'PowerFactor40081', 'Scale', 'Power Factor', 'R40081', 'R40084');

UPDATE device_template_variables
SET "displayName" = 'Power Factor', unit = ''
WHERE "registerAddress" IN ('40081', '40084', '40137')
  AND name = 'PowerFactor';

-- ── 3) Line-to-line voltage bank (40103/40105/40107) ──
UPDATE device_template_variables
SET name = 'LineVoltageA', "displayName" = 'Voltage A', unit = 'V'
WHERE "registerAddress" = '40103'
  AND name IN ('R40103', 'VoltageA40103', 'VoltageA', 'Voltage Phase A');

UPDATE device_template_variables
SET name = 'LineVoltageB', "displayName" = 'Voltage B', unit = 'V'
WHERE "registerAddress" = '40105'
  AND name IN ('R40105', 'VoltageB40105', 'VoltageB', 'Voltage Phase B');

UPDATE device_template_variables
SET name = 'LineVoltageC', "displayName" = 'Voltage C', unit = 'V'
WHERE "registerAddress" = '40107'
  AND name IN ('R40107', 'VoltageC40107', 'VoltageC', 'Voltage Phase C');

-- ── 4) Standard EMS registers (R-prefix → friendly name) ──
UPDATE device_template_variables SET name = 'VoltageA', "displayName" = 'Voltage A', unit = 'V'
WHERE "registerAddress" = '40097' AND name ~ '^R[0-9]+$';

UPDATE device_template_variables SET name = 'VoltageB', "displayName" = 'Voltage B', unit = 'V'
WHERE "registerAddress" = '40099' AND name ~ '^R[0-9]+$';

UPDATE device_template_variables SET name = 'VoltageC', "displayName" = 'Voltage C', unit = 'V'
WHERE "registerAddress" = '40101' AND name ~ '^R[0-9]+$';

UPDATE device_template_variables SET name = 'CurrentA', "displayName" = 'Current A', unit = 'A'
WHERE "registerAddress" = '40109' AND name ~ '^R[0-9]+$';

UPDATE device_template_variables SET name = 'CurrentB', "displayName" = 'Current B', unit = 'A'
WHERE "registerAddress" = '40111' AND name ~ '^R[0-9]+$';

UPDATE device_template_variables SET name = 'CurrentC', "displayName" = 'Current C', unit = 'A'
WHERE "registerAddress" = '40113' AND name ~ '^R[0-9]+$';

UPDATE device_template_variables SET name = 'ActivePower', "displayName" = 'Active Power', unit = 'W'
WHERE "registerAddress" IN ('40115', '40121') AND name ~ '^R[0-9]+$';

UPDATE device_template_variables SET name = 'ReactivePower', "displayName" = 'Reactive Power', unit = 'VAr'
WHERE "registerAddress" IN ('40123', '40129') AND name ~ '^R[0-9]+$';

UPDATE device_template_variables SET name = 'ApparentPower', "displayName" = 'Apparent Power', unit = 'VA'
WHERE "registerAddress" = '40131' AND name ~ '^R[0-9]+$';

UPDATE device_template_variables SET name = 'Energy', "displayName" = 'Energy', unit = 'kWh'
WHERE "registerAddress" = '40139' AND name ~ '^R[0-9]+$';

UPDATE device_template_variables SET name = 'ExportPower', "displayName" = 'Export Power', unit = 'kWh'
WHERE "registerAddress" = '40141' AND name ~ '^R[0-9]+$';

UPDATE device_template_variables SET name = 'Frequency', "displayName" = 'Frequency', unit = 'Hz'
WHERE "registerAddress" = '40085' AND name ~ '^R[0-9]+$';

-- ── 5) Device-specific / status registers ──
UPDATE device_template_variables SET name = 'DeviceStatus', "displayName" = 'Device Status'
WHERE "registerAddress" = '40003';

UPDATE device_template_variables SET name = 'ControlStatus', "displayName" = 'Control Status'
WHERE "registerAddress" = '00001';

UPDATE device_template_variables SET name = 'StatusWord1', "displayName" = 'Status Word 1'
WHERE "registerAddress" = '40327';

UPDATE device_template_variables SET name = 'StatusWord2', "displayName" = 'Status Word 2'
WHERE "registerAddress" = '40328';

UPDATE device_template_variables SET name = 'StatusWord3', "displayName" = 'Status Word 3'
WHERE "registerAddress" = '40329';

UPDATE device_template_variables SET name = 'StatusWord4', "displayName" = 'Status Word 4'
WHERE "registerAddress" = '40330';

UPDATE device_template_variables SET name = 'StatusWord5', "displayName" = 'Status Word 5'
WHERE "registerAddress" = '40331';

UPDATE device_template_variables SET name = 'StatusWord6', "displayName" = 'Status Word 6'
WHERE "registerAddress" = '40332';

-- ── 6) Normalize displayName for existing friendly names ──
UPDATE device_template_variables SET "displayName" = 'Voltage A', unit = 'V'
WHERE name = 'VoltageA' AND ("displayName" IS NULL OR "displayName" IN ('VoltageA', 'R40097'));

UPDATE device_template_variables SET "displayName" = 'Voltage B', unit = 'V'
WHERE name = 'VoltageB' AND ("displayName" IS NULL OR "displayName" IN ('VoltageB', 'R40099'));

UPDATE device_template_variables SET "displayName" = 'Voltage C', unit = 'V'
WHERE name = 'VoltageC' AND ("displayName" IS NULL OR "displayName" IN ('VoltageC', 'R40101'));

UPDATE device_template_variables SET "displayName" = 'Current A', unit = 'A'
WHERE name = 'CurrentA' AND ("displayName" IS NULL OR "displayName" = 'CurrentA');

UPDATE device_template_variables SET "displayName" = 'Current B', unit = 'A'
WHERE name = 'CurrentB' AND ("displayName" IS NULL OR "displayName" = 'CurrentB');

UPDATE device_template_variables SET "displayName" = 'Current C', unit = 'A'
WHERE name = 'CurrentC' AND ("displayName" IS NULL OR "displayName" = 'CurrentC');

UPDATE device_template_variables SET "displayName" = 'Active Power', unit = 'W'
WHERE name = 'ActivePower' AND ("displayName" IS NULL OR "displayName" = 'ActivePower');

UPDATE device_template_variables SET "displayName" = 'Reactive Power', unit = 'VAr'
WHERE name = 'ReactivePower' AND ("displayName" IS NULL OR "displayName" = 'ReactivePower');

UPDATE device_template_variables SET "displayName" = 'Apparent Power', unit = 'VA'
WHERE name = 'ApparentPower' AND ("displayName" IS NULL OR "displayName" = 'ApparentPower');

UPDATE device_template_variables SET "displayName" = 'Power Factor'
WHERE name = 'PowerFactor' AND ("displayName" IS NULL OR "displayName" IN ('Power Factor', 'PowerFactor'));

UPDATE device_template_variables SET "displayName" = 'Frequency', unit = 'Hz'
WHERE name = 'Frequency' AND ("displayName" IS NULL OR "displayName" = 'Frequency');

UPDATE device_template_variables SET "displayName" = 'Energy', unit = 'kWh'
WHERE name = 'Energy' AND ("displayName" IS NULL OR "displayName" = 'Energy');

UPDATE device_template_variables SET "displayName" = 'Export Power', unit = 'kWh'
WHERE name = 'ExportPower' AND ("displayName" IS NULL OR "displayName" IN ('Export Power', 'ExportPower'));

-- ── 7) Remaining R-prefix: map by register when possible ──
UPDATE device_template_variables tv SET
  name = m.new_name,
  "displayName" = m.display_name,
  unit = COALESCE(NULLIF(m.unit, ''), tv.unit)
FROM (VALUES
  ('40081', 'PowerFactor', 'Power Factor', ''),
  ('40084', 'PowerFactor', 'Power Factor', ''),
  ('40085', 'Frequency', 'Frequency', 'Hz'),
  ('40097', 'VoltageA', 'Voltage A', 'V'),
  ('40099', 'VoltageB', 'Voltage B', 'V'),
  ('40101', 'VoltageC', 'Voltage C', 'V'),
  ('40103', 'LineVoltageA', 'Voltage A', 'V'),
  ('40105', 'LineVoltageB', 'Voltage B', 'V'),
  ('40107', 'LineVoltageC', 'Voltage C', 'V'),
  ('40109', 'CurrentA', 'Current A', 'A'),
  ('40111', 'CurrentB', 'Current B', 'A'),
  ('40113', 'CurrentC', 'Current C', 'A'),
  ('40115', 'ActivePower', 'Active Power', 'W'),
  ('40121', 'ActivePower', 'Active Power', 'W'),
  ('40123', 'ReactivePower', 'Reactive Power', 'VAr'),
  ('40129', 'ReactivePower', 'Reactive Power', 'VAr'),
  ('40131', 'ApparentPower', 'Apparent Power', 'VA'),
  ('40139', 'Energy', 'Energy', 'kWh'),
  ('40141', 'ExportPower', 'Export Power', 'kWh')
) AS m(reg, new_name, display_name, unit)
WHERE tv."registerAddress" = m.reg
  AND tv.name ~ '^R[0-9]+$'
  AND NOT EXISTS (
    SELECT 1 FROM device_template_variables o
    WHERE o."templateSlaveId" = tv."templateSlaveId"
      AND o.name = m.new_name
      AND o.id <> tv.id
  );

-- ── 8) Sync live device config from templates (conflict-safe) ──
UPDATE device_config_variables cv
SET "displayName" = tv."displayName",
    unit = tv.unit
FROM device_template_variables tv
WHERE cv."templateVariableId" = tv.id;

UPDATE device_config_variables cv
SET name = tv.name
FROM device_template_variables tv
WHERE cv."templateVariableId" = tv.id
  AND cv.name IS DISTINCT FROM tv.name
  AND NOT EXISTS (
    SELECT 1 FROM device_config_variables o
    WHERE o."deviceId" = cv."deviceId"
      AND o."deviceConfigSlaveId" = cv."deviceConfigSlaveId"
      AND o.name = tv.name
      AND o.id <> cv.id
  );
