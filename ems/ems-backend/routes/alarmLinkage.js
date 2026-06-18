const express = require('express');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/alarmLinkageController');

const templateRouter = express.Router();
templateRouter.use(protect);
templateRouter.get('/',     ctrl.getAlarmTemplates);
templateRouter.post('/',    ctrl.createAlarmTemplate);
templateRouter.put('/:id',  ctrl.updateAlarmTemplate);
templateRouter.delete('/:id', ctrl.deleteAlarmTemplate);

const settingsRouter = express.Router();
settingsRouter.use(protect);
settingsRouter.get('/',     ctrl.getAlarmSettings);
settingsRouter.post('/',    ctrl.createAlarmSetting);
settingsRouter.put('/:id',  ctrl.updateAlarmSetting);
settingsRouter.delete('/:id', ctrl.deleteAlarmSetting);

const contactsRouter = express.Router();
contactsRouter.use(protect);
contactsRouter.get('/',     ctrl.getAlarmContacts);
contactsRouter.post('/',    ctrl.createAlarmContact);
contactsRouter.put('/:id',  ctrl.updateAlarmContact);
contactsRouter.delete('/:id', ctrl.deleteAlarmContact);

// Alarm history — variable alarms + linkage records
const alarmHistoryRouter = express.Router();
alarmHistoryRouter.use(protect);
alarmHistoryRouter.get('/notifications',                  ctrl.getAlarmHistoryNotifications);
alarmHistoryRouter.get('/variable-alarms',                ctrl.getVariableAlarmHistory);
alarmHistoryRouter.get('/variable-alarms/csv',            ctrl.downloadVariableAlarmCSV);
alarmHistoryRouter.patch('/variable-alarms/:id/process',  ctrl.processVariableAlarm);
alarmHistoryRouter.delete('/variable-alarms',             ctrl.batchDeleteVariableAlarms);
alarmHistoryRouter.get('/linkage-records',                ctrl.getLinkageHistory);
alarmHistoryRouter.get('/linkage-records/csv',            ctrl.downloadLinkageHistoryCSV);
alarmHistoryRouter.delete('/linkage-records',             ctrl.batchDeleteLinkageHistory);

module.exports = { templateRouter, settingsRouter, contactsRouter, alarmHistoryRouter };
