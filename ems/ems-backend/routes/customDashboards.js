const express = require('express')
const router = express.Router()
const { protect, authorize } = require('../middleware/auth')
const {
  listDashboards, getDashboard, createDashboard, updateDashboard, deleteDashboard,
  getPowerFlow, updatePowerFlow,
} = require('../controllers/customDashboardController')

router.use(protect)

router.get('/power-flow', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), getPowerFlow)
router.put('/power-flow', authorize('SUPER_ADMIN', 'ORG_ADMIN'), updatePowerFlow)

router.get('/', listDashboards)
router.get('/:id', getDashboard)
router.post('/', createDashboard)
router.put('/:id', updateDashboard)
router.delete('/:id', deleteDashboard)

module.exports = router
