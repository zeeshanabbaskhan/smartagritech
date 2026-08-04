const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDevices, getDevice, createDevice, updateDevice, deleteDevice,
  switchToggle, regenerateIngestKey, getCommandStatus,
} = require('../controllers/deviceController');

router.use(protect);

router.route('/')
  .get(getDevices)
  .post(authorize('SUPER_ADMIN'), createDevice);

router.route('/:id')
  .get(getDevice)
  .put(authorize('SUPER_ADMIN'), updateDevice)
  .delete(authorize('SUPER_ADMIN'), deleteDevice);

// USER may switch devices they can access (DeviceUser / AccessGroup ACL).
router.patch('/:id/switch', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), switchToggle);
router.post('/:id/regenerate-ingest-key', authorize('SUPER_ADMIN'), regenerateIngestKey);
router.get('/:id/commands/:commandId', getCommandStatus);

module.exports = router;
