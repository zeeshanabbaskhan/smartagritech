const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/alarmLinkageController');

const templateRouter = express.Router();
templateRouter.use(protect);
templateRouter.get('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.getAlarmTemplates);
templateRouter.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.createAlarmTemplate);
templateRouter.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.updateAlarmTemplate);
templateRouter.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.deleteAlarmTemplate);

const settingsRouter = express.Router();
settingsRouter.use(protect);
settingsRouter.get('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.getAlarmSettings);
settingsRouter.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.createAlarmSetting);
settingsRouter.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.updateAlarmSetting);
settingsRouter.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.deleteAlarmSetting);

const contactsRouter = express.Router();
contactsRouter.use(protect);
contactsRouter.get('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.getAlarmContacts);
contactsRouter.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.createAlarmContact);
contactsRouter.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.updateAlarmContact);
contactsRouter.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.deleteAlarmContact);

// Alarm history — variable alarms + linkage records
const alarmHistoryRouter = express.Router();
alarmHistoryRouter.use(protect);
alarmHistoryRouter.get('/notifications', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.getAlarmHistoryNotifications);
alarmHistoryRouter.get('/variable-alarms', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.getVariableAlarmHistory);
alarmHistoryRouter.get('/variable-alarms/csv', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.downloadVariableAlarmCSV);
alarmHistoryRouter.patch('/variable-alarms/:id/process', authorize('SUPER_ADMIN', 'ORG_ADMIN'), ctrl.processVariableAlarm);
alarmHistoryRouter.delete('/variable-alarms', authorize('SUPER_ADMIN', 'ORG_ADMIN'), ctrl.batchDeleteVariableAlarms);
alarmHistoryRouter.get('/linkage-records', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.getLinkageHistory);
alarmHistoryRouter.get('/linkage-records/csv', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), ctrl.downloadLinkageHistoryCSV);
alarmHistoryRouter.delete('/linkage-records', authorize('SUPER_ADMIN', 'ORG_ADMIN'), ctrl.batchDeleteLinkageHistory);

module.exports = { templateRouter, settingsRouter, contactsRouter, alarmHistoryRouter };
