const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getMyOrganization, updateMyOrganization } = require('../controllers/organizationSelfController');

router.use(protect);

router.get('/', getMyOrganization);
router.put('/', authorize('ORG_ADMIN'), updateMyOrganization);

module.exports = router;
