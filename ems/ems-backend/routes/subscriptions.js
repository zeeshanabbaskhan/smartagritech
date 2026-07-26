const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { createSubscription, getSubscriptions, updateSubscriptionStatus } = require('../controllers/subscriptionController');

router.post('/', createSubscription); // public — no auth

// SUPER_ADMIN: all; ORG_ADMIN/USER: own email (and org-linked for ORG_ADMIN)
router.get('/',                 protect, authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), getSubscriptions);
router.patch('/:id/status',     protect, authorize('SUPER_ADMIN'), updateSubscriptionStatus);

module.exports = router;
