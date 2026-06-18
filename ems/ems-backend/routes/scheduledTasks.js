const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { getScheduledTasks, createScheduledTask, updateScheduledTask, deleteScheduledTask, toggleTask, getTaskLogs } = require('../controllers/scheduledTaskController');

router.use(protect);

router.get('/',    getScheduledTasks);
router.post('/',   createScheduledTask);
router.put('/:id', updateScheduledTask);
router.delete('/:id', deleteScheduledTask);
router.patch('/:id/toggle', toggleTask);
router.get('/:id/logs', getTaskLogs);

module.exports = router;
