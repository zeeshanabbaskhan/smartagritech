const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getWidgetTemplates, createWidgetTemplate, updateWidgetTemplate, deleteWidgetTemplate,
} = require('../controllers/widgetTemplateController');

router.use(protect);

router.route('/')
  .get(getWidgetTemplates)
  .post(authorize('SUPER_ADMIN', 'ORG_ADMIN'), createWidgetTemplate);

router.route('/:id')
  .put(authorize('SUPER_ADMIN', 'ORG_ADMIN'), updateWidgetTemplate)
  .delete(authorize('SUPER_ADMIN', 'ORG_ADMIN'), deleteWidgetTemplate);

module.exports = router;
