const express = require('express');
const router  = express.Router({ mergeParams: true });
const { protect, authorize } = require('../middleware/auth');
const {
  getVariables, createVariable, updateVariable, deleteVariable,
} = require('../controllers/templateVariableController');

router.use(protect);

router.route('/')
  .get(getVariables)
  .post(authorize('SUPER_ADMIN', 'ORG_ADMIN'), createVariable);

router.route('/:variableId')
  .put(authorize('SUPER_ADMIN', 'ORG_ADMIN'), updateVariable)
  .delete(authorize('SUPER_ADMIN', 'ORG_ADMIN'), deleteVariable);

module.exports = router;
