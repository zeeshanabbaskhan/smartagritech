const express = require('express');
const router  = express.Router({ mergeParams: true });
const { protect, authorize } = require('../middleware/auth');
const { getDeviceUsers, assignUser, removeUser } = require('../controllers/deviceUserController');

router.use(protect);

router.route('/')
  .get(getDeviceUsers)
  .post(authorize('SUPER_ADMIN', 'ORG_ADMIN'), assignUser);

router.delete('/:userId', authorize('SUPER_ADMIN', 'ORG_ADMIN'), removeUser);

module.exports = router;
