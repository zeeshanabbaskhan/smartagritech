-- Remaining row: 40084 named "Power Factor" on slave that already has PowerFactor (40137)
UPDATE device_template_variables
SET name = 'PowerFactor40084', "displayName" = 'Power Factor', "acquisitionFormula" = '=s/1000'
WHERE "registerAddress" = '40084' AND name = 'Power Factor';

UPDATE device_config_variables cv
SET name = tv.name, "displayName" = tv."displayName", unit = tv.unit
FROM device_template_variables tv
WHERE cv."templateVariableId" = tv.id AND tv."registerAddress" = '40084' AND tv.name = 'PowerFactor40084';
