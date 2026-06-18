const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getSlabRates, createSlabRate, updateSlabRate, deleteSlabRate } = require('../controllers/slabRateController');

router.use(protect, authorize('ORG_ADMIN', 'USER'));

router.get('/',    getSlabRates);
router.post('/',   createSlabRate);
router.put('/:id', updateSlabRate);
router.delete('/:id', deleteSlabRate);

module.exports = router;
