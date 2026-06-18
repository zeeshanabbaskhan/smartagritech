const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getIntervalHistory, createIntervalHistory, deleteIntervalHistory } = require('../controllers/intervalHistoryController');

router.use(protect, authorize('ORG_ADMIN', 'USER'));

router.get('/',    getIntervalHistory);
router.post('/',   createIntervalHistory);
router.delete('/:id', deleteIntervalHistory);

module.exports = router;
