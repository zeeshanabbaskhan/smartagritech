const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getUsers, getUser, createUser, updateUser, updateUserStatus, adminResetPassword,
} = require('../controllers/userController');

router.use(protect, authorize('SUPER_ADMIN', 'ORG_ADMIN'));

router.route('/')
  .get(getUsers)
  .post(createUser);

router.route('/:id')
  .get(getUser)
  .put(updateUser);

router.patch('/:id/status',         updateUserStatus);
router.post('/:id/reset-password',  adminResetPassword);

module.exports = router;
