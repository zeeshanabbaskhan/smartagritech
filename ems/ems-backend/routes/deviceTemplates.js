const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDeviceTemplates, getDeviceTemplate,
  createDeviceTemplate, updateDeviceTemplate,
  deleteDeviceTemplate, cloneDeviceTemplate,
} = require('../controllers/deviceTemplateController');

router.use(protect);

router.route('/')
  .get(getDeviceTemplates)
  .post(authorize('SUPER_ADMIN', 'ORG_ADMIN'), createDeviceTemplate);

router.route('/:id')
  .get(getDeviceTemplate)
  .put(authorize('SUPER_ADMIN', 'ORG_ADMIN'), updateDeviceTemplate)
  .delete(authorize('SUPER_ADMIN', 'ORG_ADMIN'), deleteDeviceTemplate);

router.post('/:id/clone', authorize('SUPER_ADMIN', 'ORG_ADMIN'), cloneDeviceTemplate);

module.exports = router;
