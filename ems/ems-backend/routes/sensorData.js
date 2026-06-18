const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getLatest,
  getHistory,
  getAggregate,
  getDashboardSummary,
  getReadingsBrowse,
  downloadCSV,
  deleteReadings,
} = require('../controllers/sensorDataController');

router.use(protect);

router.get('/latest', getLatest);
router.get('/history', getHistory);
router.get('/readings', getReadingsBrowse);
router.get('/aggregate', getAggregate);
router.get('/dashboard-summary', getDashboardSummary);
router.get('/download', downloadCSV);
router.delete('/', authorize('SUPER_ADMIN'), deleteReadings);

module.exports = router;
