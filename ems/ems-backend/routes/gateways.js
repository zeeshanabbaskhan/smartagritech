const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getGateways, getGateway, createGateway, updateGateway, deleteGateway,
} = require('../controllers/gatewayController');

router.use(protect);

router.route('/')
  .get(getGateways)
  .post(authorize('SUPER_ADMIN', 'ORG_ADMIN'), createGateway);

router.route('/:id')
  .get(getGateway)
  .put(authorize('SUPER_ADMIN', 'ORG_ADMIN'), updateGateway)
  .delete(authorize('SUPER_ADMIN', 'ORG_ADMIN'), deleteGateway);

module.exports = router;
