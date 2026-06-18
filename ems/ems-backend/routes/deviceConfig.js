const express = require('express');
const router  = express.Router({ mergeParams: true });
const { protect } = require('../middleware/auth');
const {
  getFullConfig,
  getConfigSlaves,
  getConfigSlaveVariables,
  updateConfigVariable,
  getConfigVariableLog,
} = require('../controllers/deviceConfigController');

router.use(protect);

router.get('/', getFullConfig);
router.get('/slaves', getConfigSlaves);
router.get('/slaves/:configSlaveId/variables', getConfigSlaveVariables);
router.patch('/variables/:configVariableId', updateConfigVariable);
router.get('/variables/:configVariableId/log', getConfigVariableLog);

module.exports = router;
