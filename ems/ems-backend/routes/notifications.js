const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getNotifications, markRead, markAllRead,
  deleteAllNotifications, deleteNotification,
} = require('../controllers/notificationController');

router.use(protect);

router.get('/',    getNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);
router.delete('/', deleteAllNotifications);
router.delete('/:id', deleteNotification);

module.exports = router;
