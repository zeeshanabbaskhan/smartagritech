const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getSlabRates, createSlabRate, updateSlabRate, deleteSlabRate } = require('../controllers/slabRateController');

router.use(protect);

router.get('/',    authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), getSlabRates);
router.post('/',   authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), createSlabRate);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), updateSlabRate);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), deleteSlabRate);

module.exports = router;
