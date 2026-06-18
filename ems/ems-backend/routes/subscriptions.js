const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { createSubscription, getSubscriptions, updateSubscriptionStatus } = require('../controllers/subscriptionController');

router.post('/', createSubscription); // public — no auth

router.get('/',                 protect, authorize('SUPER_ADMIN'), getSubscriptions);
router.patch('/:id/status',     protect, authorize('SUPER_ADMIN'), updateSubscriptionStatus);

module.exports = router;
