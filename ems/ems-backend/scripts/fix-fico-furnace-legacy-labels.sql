-- Match legacy cfsmartems.com Fico Furnace labels + formulas (minimal, targeted).

-- ── Fico Furnace slave: 11 vars only (hide THD/status extras not on legacy tab) ──
UPDATE device_template_variables tv
SET "isActive" = false
FROM device_template_slaves ts
JOIN device_templates dt ON dt.id = ts."templateId"
WHERE tv."templateSlaveId" = ts.id
  AND dt.name ILIKE '%Fico Furnace%'
  AND ts.name = 'Fico Furnace'
  AND tv."registerAddress" IN ('40327','40328','40329','40330','40331','40332');

UPDATE device_config_variables cv
SET "isActive" = false
FROM device_template_variables tv, device_config_slaves cs, devices d
WHERE cv."templateVariableId" = tv.id
  AND cv."deviceConfigSlaveId" = cs.id
  AND cv."deviceId" = d.id
  AND d.name = 'Fico Furnace'
  AND cs.name = 'Fico Furnace'
  AND tv."registerAddress" IN ('40327','40328','40329','40330','40331','40332');

-- ── Temperature 40003 = raw/10 → ~41°C ──
UPDATE device_template_variables
SET name = 'Temperature', "displayName" = 'Temperature', unit = '°C', "acquisitionFormula" = '=s/10'
WHERE "registerAddress" = '40003';

-- ── Main slave: Phase voltages (legacy "Phase Voltage A/B/C") ──
UPDATE device_template_variables tv
SET name = 'PhaseVoltageA', "displayName" = 'Phase Voltage A', unit = 'V'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40103';

UPDATE device_template_variables tv
SET name = 'PhaseVoltageB', "displayName" = 'Phase Voltage B', unit = 'V'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40105';

UPDATE device_template_variables tv
SET name = 'PhaseVoltageC', "displayName" = 'Phase Voltage C', unit = 'V'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40107';

-- ── Fico Furnace slave: Operating Power, Units (legacy names) ──
UPDATE device_template_variables tv
SET name = 'ActivePower', "displayName" = 'Operating Power', unit = 'kW', "acquisitionFormula" = '=s/1000'
FROM device_template_slaves ts
JOIN device_templates dt ON dt.id = ts."templateId"
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Fico Furnace' AND dt.name ILIKE '%Fico Furnace%'
  AND tv."registerAddress" = '40121';

UPDATE device_template_variables tv
SET name = 'ExportPower', "displayName" = 'Units', unit = 'kWh'
FROM device_template_slaves ts
JOIN device_templates dt ON dt.id = ts."templateId"
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Fico Furnace' AND dt.name ILIKE '%Fico Furnace%'
  AND tv."registerAddress" = '40141';

-- ── Main slave: Active/Reactive/Apparent/Consumption/Export/THD (legacy names) ──
UPDATE device_template_variables tv
SET name = 'ActivePower', "displayName" = 'Active Power', unit = 'kW', "acquisitionFormula" = '=s/1000'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40121';

UPDATE device_template_variables tv
SET name = 'ReactivePower', "displayName" = 'Reactive Power', unit = 'kVar', "acquisitionFormula" = '=s/1000'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40129';

UPDATE device_template_variables tv
SET name = 'ApparentPower', "displayName" = 'Apparent Power', unit = 'kVA', "acquisitionFormula" = '=s/1000'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40137';

UPDATE device_template_variables tv
SET name = 'Energy', "displayName" = 'Power Consumption', unit = 'kWh'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40139';

UPDATE device_template_variables tv
SET name = 'ExportPower', "displayName" = 'Export Power', unit = 'kWh'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40141';

UPDATE device_template_variables tv
SET name = 'THDUa', "displayName" = 'THD Ua', unit = '%'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40327';

UPDATE device_template_variables tv
SET name = 'THDUb', "displayName" = 'THD Ub', unit = '%'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40328';

UPDATE device_template_variables tv
SET name = 'THDUc', "displayName" = 'THD Uc', unit = '%'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40329';

UPDATE device_template_variables tv
SET name = 'THDIa', "displayName" = 'THD Ia', unit = '%'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40330';

UPDATE device_template_variables tv
SET name = 'THDIb', "displayName" = 'THD Ib', unit = '%'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40331';

UPDATE device_template_variables tv
SET name = 'THDIc', "displayName" = 'THD Ic', unit = '%'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id AND ts.name = 'Main' AND tv."registerAddress" = '40332';

-- ── Standard formulas (fleet-wide for these registers) ──
UPDATE device_template_variables SET "acquisitionFormula" = '=s/1000'
WHERE "registerAddress" = '40084' AND COALESCE(NULLIF(TRIM("controlFormula"),''), NULL) IS NULL;

UPDATE device_template_variables SET "acquisitionFormula" = '=s/100'
WHERE "registerAddress" = '40085' AND COALESCE(NULLIF(TRIM("controlFormula"),''), NULL) IS NULL;

-- ── Sync device config from template ──
UPDATE device_config_variables cv
SET "displayName" = tv."displayName", unit = tv.unit, "isActive" = tv."isActive"
FROM device_template_variables tv
WHERE cv."templateVariableId" = tv.id
  AND cv."deviceId" IN (SELECT id FROM devices WHERE name = 'Fico Furnace');

UPDATE device_config_variables cv
SET name = tv.name
FROM device_template_variables tv
WHERE cv."templateVariableId" = tv.id
  AND cv."deviceId" IN (SELECT id FROM devices WHERE name = 'Fico Furnace')
  AND cv.name IS DISTINCT FROM tv.name
  AND NOT EXISTS (
    SELECT 1 FROM device_config_variables o
    WHERE o."deviceId" = cv."deviceId" AND o."deviceConfigSlaveId" = cv."deviceConfigSlaveId"
      AND o.name = tv.name AND o.id <> cv.id
  );
