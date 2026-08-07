const express = require('express');
const router = express.Router();
const {
  login, logout, refresh, getMe, forgotPassword, resetPassword, changePassword,
  impersonateUser, impersonateOrganization,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const { loginLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiter');

router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.post('/change-password', protect, changePassword);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

router.post('/impersonate/user/:userId', protect, authorize('SUPER_ADMIN'), impersonateUser);
router.post('/impersonate/organization/:organizationId', protect, authorize('SUPER_ADMIN'), impersonateOrganization);

module.exports = router;
