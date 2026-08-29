-- THD U/I on Main slave only — match legacy Elsa ControlFormula %s/10 (= =s/10 here).
-- Scoped to Fico Furnace template; does not touch Fico Furnace slave or other templates.

UPDATE device_template_variables tv
SET "controlFormula" = '=s/10'
FROM device_template_slaves ts
JOIN device_templates dt ON dt.id = ts."templateId"
WHERE tv."templateSlaveId" = ts.id
  AND ts.name = 'Main'
  AND dt.name ILIKE '%Fico Furnace%'
  AND tv."registerAddress" IN ('40327', '40328', '40329', '40330', '40331', '40332');
