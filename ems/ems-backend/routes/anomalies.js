const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { getAnomalies, getAnomalyTimeline, acknowledgeAnomaly } = require('../controllers/anomalyController');

router.use(protect);

router.get('/',          getAnomalies);
router.get('/timeline',  getAnomalyTimeline);
router.patch('/:id/acknowledge', acknowledgeAnomaly);

module.exports = router;
