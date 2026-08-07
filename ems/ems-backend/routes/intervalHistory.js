const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getIntervalHistory, createIntervalHistory, deleteIntervalHistory } = require('../controllers/intervalHistoryController');

router.use(protect);

router.get('/',    authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), getIntervalHistory);
router.post('/',   authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), createIntervalHistory);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), deleteIntervalHistory);

module.exports = router;
