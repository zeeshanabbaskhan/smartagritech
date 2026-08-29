-- NUST template: register must match MQTT key exactly (40097 not 97)
UPDATE device_template_variables
SET "registerAddress" = '40097'
WHERE "templateId" = 'c630a311-7f68-4c3a-b2eb-bc5b80bc9afd'
  AND name = 'Voltage';
