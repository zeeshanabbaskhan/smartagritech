-- FICO EV FicoInverter only: match legacy Elsa ControlFormula %s*-1/1000.
-- MQTT 40081 is negative; legacy displays positive PF (e.g. 0.92).
-- Scoped via FICOEV device template — does not touch Charger or InverterMain.

UPDATE device_template_variables tv
SET "controlFormula" = '=s*-1/1000'
FROM device_template_slaves ts
WHERE tv."templateSlaveId" = ts.id
  AND ts.name = 'FicoInverter'
  AND tv."registerAddress" = '40081'
  AND ts."templateId" = (SELECT "templateId" FROM devices WHERE name = 'FICOEV' LIMIT 1);
