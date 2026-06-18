const express = require('express');
const router  = express.Router({ mergeParams: true });
const { protect, authorize } = require('../middleware/auth');
const {
  getSlaves, createSlave, updateSlave, deleteSlave,
} = require('../controllers/templateSlaveController');

router.use(protect);

router.route('/')
  .get(getSlaves)
  .post(authorize('SUPER_ADMIN', 'ORG_ADMIN'), createSlave);

router.route('/:slaveId')
  .put(authorize('SUPER_ADMIN', 'ORG_ADMIN'), updateSlave)
  .delete(authorize('SUPER_ADMIN', 'ORG_ADMIN'), deleteSlave);

module.exports = router;
