const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getDeviceTimestamps } = require('../controllers/deviceTimestampController');

router.use(protect, authorize('SUPER_ADMIN', 'ORG_ADMIN'));

router.get('/', getDeviceTimestamps);

module.exports = router;
