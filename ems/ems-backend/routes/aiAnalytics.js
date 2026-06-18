const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getPredictions, getVoltageAnalysis, getCurrentAnalysis,
  getPowerFactorAnalysis, getEnergyAnalysis,
} = require('../controllers/aiAnalyticsController');

router.use(protect);

router.get('/predictions',        getPredictions);
router.get('/voltage-imbalance',  getVoltageAnalysis);
router.get('/current-imbalance',  getCurrentAnalysis);
router.get('/power-factor',       getPowerFactorAnalysis);
router.get('/energy-consumption', getEnergyAnalysis);

module.exports = router;
