const express = require('express');
const router  = express.Router({ mergeParams: true });
const { protect, authorize } = require('../middleware/auth');
const {
  getSlaves, createSlave, updateSlave, deleteSlave,
} = require('../controllers/templateSlaveController');

router.use(protect);

router.route('/')
  .get(authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), getSlaves)
  .post(authorize('SUPER_ADMIN'), createSlave);

router.route('/:slaveId')
  .put(authorize('SUPER_ADMIN'), updateSlave)
  .delete(authorize('SUPER_ADMIN'), deleteSlave);

module.exports = router;
