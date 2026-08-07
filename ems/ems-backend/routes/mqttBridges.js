const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth')
const {
  listBridges,
  getBridge,
  createBridge,
  updateBridge,
  deleteBridge,
  start,
  stop,
} = require('../controllers/mqttBridgeController')

router.use(protect)

router
  .route('/')
  .get(authorize('SUPER_ADMIN', 'ORG_ADMIN'), listBridges)
  .post(authorize('SUPER_ADMIN'), createBridge)

router
  .route('/:id')
  .get(authorize('SUPER_ADMIN', 'ORG_ADMIN'), getBridge)
  .put(authorize('SUPER_ADMIN'), updateBridge)
  .delete(authorize('SUPER_ADMIN'), deleteBridge)

router.post('/:id/start', authorize('SUPER_ADMIN'), start)
router.post('/:id/stop', authorize('SUPER_ADMIN'), stop)

module.exports = router
