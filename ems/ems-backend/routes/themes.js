const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadThemeLogo } = require('../middleware/upload');
const { AppError } = require('../middleware/errorHandler');
const {
  getPublicBranding, getActiveTheme, getThemes, createTheme, updateTheme, deleteTheme, assignTheme,
} = require('../controllers/themeController');

const handleUpload = (middleware) => (req, res, next) =>
  middleware(req, res, (err) => {
    if (err) return next(new AppError(err.message || 'Logo upload failed', 400));
    next();
  });

// Public platform branding for login / unauthenticated chrome
router.get('/branding', getPublicBranding);

router.use(protect);

// Any authenticated role (SUPER_ADMIN, ORG_ADMIN, USER)
router.get('/active', getActiveTheme);

router.use(authorize('SUPER_ADMIN'));

router.get('/', getThemes);
router.post('/', handleUpload(uploadThemeLogo), createTheme);
router.put('/:id', handleUpload(uploadThemeLogo), updateTheme);
router.delete('/:id', deleteTheme);
router.post('/:id/assign', assignTheme);

module.exports = router;
