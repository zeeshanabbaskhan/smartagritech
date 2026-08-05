const express = require('express');
const router  = express.Router({ mergeParams: true });
const { protect, authorize } = require('../middleware/auth');
const {
  getVariables, createVariable, updateVariable, deleteVariable,
  sortVariables, setDefaultUnit,
} = require('../controllers/templateVariableController');

router.use(protect);

router.route('/')
  .get(authorize('SUPER_ADMIN', 'ORG_ADMIN', 'USER'), getVariables)
  .post(authorize('SUPER_ADMIN'), createVariable);

router.post('/sort', authorize('SUPER_ADMIN'), sortVariables);

router.route('/:variableId')
  .put(authorize('SUPER_ADMIN'), updateVariable)
  .delete(authorize('SUPER_ADMIN'), deleteVariable);

router.post(
  '/:variableId/default-unit',
  authorize('SUPER_ADMIN'),
  setDefaultUnit
);

module.exports = router;
