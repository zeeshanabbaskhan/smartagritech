const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth')
const {
  listAccessGroups, createAccessGroup, updateAccessGroup, deleteAccessGroup,
} = require('../controllers/accessGroupController')

router.use(protect)
router.use(authorize('SUPER_ADMIN', 'ORG_ADMIN'))

router.get('/', listAccessGroups)
router.post('/', createAccessGroup)
router.put('/:id', updateAccessGroup)
router.delete('/:id', deleteAccessGroup)

module.exports = router
