const express = require('express');
const router  = express.Router();

const { templateRouter, settingsRouter, contactsRouter, alarmHistoryRouter } = require('./alarmLinkage');

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.use('/auth',              require('./auth'));

// ─── Devices + Device sub-resources ──────────────────────────────────────────
router.use('/devices',           require('./devices'));
router.use('/devices/:deviceId/config', require('./deviceConfig'));
router.use('/devices/:deviceId/users',  require('./deviceUsers'));

// ─── Device Templates + sub-resources ────────────────────────────────────────
router.use('/device-templates',  require('./deviceTemplates'));
router.use('/device-templates/:templateId/slaves', require('./templateSlaves'));
router.use('/device-templates/:templateId/slaves/:slaveId/variables', require('./templateVariables'));

// ─── Sensor data & analytics ─────────────────────────────────────────────────
router.use('/sensor-data',       require('./sensorData'));
router.use('/anomalies',         require('./anomalies'));
router.use('/interval-history',  require('./intervalHistory'));
router.use('/ai',                require('./aiAnalytics'));

// ─── Alarm system ─────────────────────────────────────────────────────────────
router.use('/alarm-templates',   templateRouter);
router.use('/alarm-settings',    settingsRouter);
router.use('/alarm-contacts',    contactsRouter);
router.use('/alarm-history',     alarmHistoryRouter);

// ─── Notifications ────────────────────────────────────────────────────────────
router.use('/notifications',     require('./notifications'));

// ─── Scheduling ───────────────────────────────────────────────────────────────
router.use('/scheduled-tasks',   require('./scheduledTasks'));

// ─── Widget Templates ─────────────────────────────────────────────────────────
router.use('/widget-templates',  require('./widgetTemplates'));

// ─── List types (new two-table system) + legacy list-items ───────────────────
router.use('/list-types',        require('./listTypes'));
router.use('/list-items',        require('./listItems'));

// ─── Organizations / Users / Gateways ────────────────────────────────────────
router.use('/organizations/me',    require('./organizationSelf'));
router.use('/organizations',     require('./organizations'));
router.use('/users',             require('./users'));
router.use('/gateways',          require('./gateways'));

// ─── Other resources ─────────────────────────────────────────────────────────
router.use('/slab-rates',        require('./slabRates'));
router.use('/device-timestamps', require('./deviceTimestamps'));
router.use('/icons',             require('./icons'));
router.use('/products',          require('./products'));
router.use('/themes',            require('./themes'));
router.use('/settings',          require('./settings'));
router.use('/subscriptions',     require('./subscriptions'));

module.exports = router;
