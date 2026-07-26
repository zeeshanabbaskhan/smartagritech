const express = require('express');
const router = express.Router();
const { login, logout, refresh, getMe, impersonate, forgotPassword, resetPassword, changePassword } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const { loginLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiter');

router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.post('/impersonate', protect, authorize('SUPER_ADMIN'), impersonate);
router.post('/change-password', protect, changePassword);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
