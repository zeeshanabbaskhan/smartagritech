-- Revert invented labels for registers we do NOT have a confirmed meaning for.
-- Unknown registers: show register number only (displayName = address), not "Status Word" etc.

UPDATE device_template_variables SET name = 'R40003', "displayName" = '40003'
WHERE "registerAddress" = '40003';

UPDATE device_template_variables SET name = 'R00001', "displayName" = '00001'
WHERE "registerAddress" = '00001';

UPDATE device_template_variables SET name = 'R40327', "displayName" = '40327'
WHERE "registerAddress" = '40327';

UPDATE device_template_variables SET name = 'R40328', "displayName" = '40328'
WHERE "registerAddress" = '40328';

UPDATE device_template_variables SET name = 'R40329', "displayName" = '40329'
WHERE "registerAddress" = '40329';

UPDATE device_template_variables SET name = 'R40330', "displayName" = '40330'
WHERE "registerAddress" = '40330';

UPDATE device_template_variables SET name = 'R40331', "displayName" = '40331'
WHERE "registerAddress" = '40331';

UPDATE device_template_variables SET name = 'R40332', "displayName" = '40332'
WHERE "registerAddress" = '40332';

-- 40137: revert guessed "Apparent Power" — meaning not confirmed
UPDATE device_template_variables SET name = 'R40137', "displayName" = '40137'
WHERE "registerAddress" = '40137';

-- User-confirmed register labels only (displayName = what operators see)
UPDATE device_template_variables SET name = 'PowerFactor', "displayName" = 'Power Factor', unit = ''
WHERE "registerAddress" IN ('40081', '40084') AND name NOT IN ('PowerFactor');

UPDATE device_template_variables SET "displayName" = 'Power Factor', unit = ''
WHERE "registerAddress" IN ('40081', '40084') AND name = 'PowerFactor';

UPDATE device_template_variables SET name = 'Frequency', "displayName" = 'Frequency', unit = 'Hz'
WHERE "registerAddress" = '40085';

UPDATE device_template_variables SET name = 'VoltageA', "displayName" = 'Voltage A', unit = 'V'
WHERE "registerAddress" = '40097';

UPDATE device_template_variables SET name = 'VoltageB', "displayName" = 'Voltage B', unit = 'V'
WHERE "registerAddress" = '40099';

UPDATE device_template_variables SET name = 'VoltageC', "displayName" = 'Voltage C', unit = 'V'
WHERE "registerAddress" = '40101';

UPDATE device_template_variables SET name = 'LineVoltageA', "displayName" = 'Voltage A', unit = 'V'
WHERE "registerAddress" = '40103';

UPDATE device_template_variables SET name = 'LineVoltageB', "displayName" = 'Voltage B', unit = 'V'
WHERE "registerAddress" = '40105';

UPDATE device_template_variables SET name = 'LineVoltageC', "displayName" = 'Voltage C', unit = 'V'
WHERE "registerAddress" = '40107';

UPDATE device_template_variables SET name = 'CurrentA', "displayName" = 'Current A', unit = 'A'
WHERE "registerAddress" = '40109';

UPDATE device_template_variables SET name = 'CurrentB', "displayName" = 'Current B', unit = 'A'
WHERE "registerAddress" = '40111';

UPDATE device_template_variables SET name = 'CurrentC', "displayName" = 'Current C', unit = 'A'
WHERE "registerAddress" = '40113';

UPDATE device_template_variables SET name = 'ActivePower', "displayName" = 'Active Power', unit = 'W'
WHERE "registerAddress" IN ('40115', '40121');

UPDATE device_template_variables SET name = 'ReactivePower', "displayName" = 'Reactive Power', unit = 'VAr'
WHERE "registerAddress" IN ('40123', '40129');

UPDATE device_template_variables SET name = 'ApparentPower', "displayName" = 'Apparent Power', unit = 'VA'
WHERE "registerAddress" = '40131';

UPDATE device_template_variables SET name = 'Energy', "displayName" = 'Energy', unit = 'kWh'
WHERE "registerAddress" = '40139';

UPDATE device_template_variables SET name = 'ExportPower', "displayName" = 'Export Power', unit = 'kWh'
WHERE "registerAddress" = '40141';

-- Remaining R-prefix on KNOWN registers → friendly name (skip if name collision on same slave)
UPDATE device_template_variables tv SET
  name = m.nm, "displayName" = m.dn, unit = COALESCE(NULLIF(m.u, ''), tv.unit)
FROM (VALUES
  ('40081','PowerFactor','Power Factor',''),
  ('40084','PowerFactor','Power Factor',''),
  ('40085','Frequency','Frequency','Hz'),
  ('40097','VoltageA','Voltage A','V'),
  ('40099','VoltageB','Voltage B','V'),
  ('40101','VoltageC','Voltage C','V'),
  ('40103','LineVoltageA','Voltage A','V'),
  ('40105','LineVoltageB','Voltage B','V'),
  ('40107','LineVoltageC','Voltage C','V'),
  ('40109','CurrentA','Current A','A'),
  ('40111','CurrentB','Current B','A'),
  ('40113','CurrentC','Current C','A'),
  ('40115','ActivePower','Active Power','W'),
  ('40121','ActivePower','Active Power','W'),
  ('40123','ReactivePower','Reactive Power','VAr'),
  ('40129','ReactivePower','Reactive Power','VAr'),
  ('40131','ApparentPower','Apparent Power','VA'),
  ('40139','Energy','Energy','kWh'),
  ('40141','ExportPower','Export Power','kWh')
) AS m(reg, nm, dn, u)
WHERE tv."registerAddress" = m.reg AND tv.name ~ '^R[0-9]+$'
  AND NOT EXISTS (
    SELECT 1 FROM device_template_variables o
    WHERE o."templateSlaveId" = tv."templateSlaveId" AND o.name = m.nm AND o.id <> tv.id
  );

-- Fix PowerFactor40084 suffix (only displayName; keep internal name if conflict)
UPDATE device_template_variables SET "displayName" = 'Power Factor', unit = ''
WHERE name = 'PowerFactor40084';

UPDATE device_template_variables SET name = 'PowerFactor', "displayName" = 'Power Factor'
WHERE name = 'PowerFactor40084'
  AND NOT EXISTS (
    SELECT 1 FROM device_template_variables o
    WHERE o."templateSlaveId" = device_template_variables."templateSlaveId"
      AND o.name = 'PowerFactor' AND o.id <> device_template_variables.id
  );

-- Sync device config (displayName always; name only when safe)
UPDATE device_config_variables cv
SET "displayName" = tv."displayName", unit = tv.unit
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
      AND o.name = tv.name AND o.id <> cv.id
  );
