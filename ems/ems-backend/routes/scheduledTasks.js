const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getScheduledTasks, createScheduledTask, updateScheduledTask, deleteScheduledTask, toggleTask, getTaskLogs } = require('../controllers/scheduledTaskController');

router.use(protect);

router.get('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), getScheduledTasks);
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), createScheduledTask);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), updateScheduledTask);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), deleteScheduledTask);
router.patch('/:id/toggle', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), toggleTask);
router.get('/:id/logs', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), getTaskLogs);

module.exports = router;
