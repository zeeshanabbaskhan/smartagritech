const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getOrganizations, getOrganization,
  createOrganization, updateOrganization, deleteOrganization,
} = require('../controllers/organizationController');

router.use(protect, authorize('SUPER_ADMIN'));

router.route('/')
  .get(getOrganizations)
  .post(createOrganization);

router.route('/:id')
  .get(getOrganization)
  .put(updateOrganization)
  .delete(deleteOrganization);

module.exports = router;
