-- FICOEV: use FicoInverter as default dashboard slave
UPDATE device_config_slaves SET "isDefault" = false
WHERE "deviceId" = '124c2d15-9614-4dcb-967c-1971f393b23d';
UPDATE device_config_slaves SET "isDefault" = true
WHERE id = '9937188f-eeed-414a-b134-f8d4d890c2f1';
