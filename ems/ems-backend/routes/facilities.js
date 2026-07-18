const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth')
const {
  getFacilityTree, createFacilityNode, updateFacilityNode,
  deleteFacilityNode, replaceFacilityTree, setFacilityDevices,
} = require('../controllers/facilityController')

router.use(protect)

router.get('/', getFacilityTree)
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN'), createFacilityNode)
router.put('/replace', authorize('SUPER_ADMIN', 'ORG_ADMIN'), replaceFacilityTree)
router.put('/:id/devices', authorize('SUPER_ADMIN', 'ORG_ADMIN'), setFacilityDevices)
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), updateFacilityNode)
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), deleteFacilityNode)

module.exports = router
