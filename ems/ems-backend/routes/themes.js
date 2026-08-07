const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const {
  getActiveTheme, getThemes, createTheme, updateTheme, deleteTheme, assignTheme,
} = require('../controllers/themeController');

const handleUpload = (middleware) => (req, res, next) =>
  middleware(req, res, (err) => {
    // Logo is optional — continue without file if Cloudinary/multer fails
    if (err) {
      req.file = undefined
      req.uploadError = err.message
    }
    next()
  });

router.use(protect);

router.get('/active', getActiveTheme);

router.use(authorize('SUPER_ADMIN'));

router.get('/', getThemes);
router.post('/', handleUpload(uploadSingle), createTheme);
router.put('/:id', handleUpload(uploadSingle), updateTheme);
router.delete('/:id', deleteTheme);
router.post('/:id/assign', assignTheme);

module.exports = router;
