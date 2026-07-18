const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth')
const {
  listDeviceGroups, createDeviceGroup, updateDeviceGroup, deleteDeviceGroup,
} = require('../controllers/deviceGroupController')

router.use(protect)
router.use(authorize('SUPER_ADMIN', 'ORG_ADMIN'))

router.get('/', listDeviceGroups)
router.post('/', createDeviceGroup)
router.put('/:id', updateDeviceGroup)
router.delete('/:id', deleteDeviceGroup)

module.exports = router
