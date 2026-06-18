const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadIcon } = require('../middleware/upload');
const { getIcons, createIcon, updateIcon, deleteIcon } = require('../controllers/iconController');

// Wrap multer to forward errors to Express error handler
const handleUpload = (middleware) => (req, res, next) =>
  middleware(req, res, (err) => (err ? next(err) : next()));

router.get('/', protect, getIcons);
router.post('/',    protect, authorize('SUPER_ADMIN'), handleUpload(uploadIcon), createIcon);
router.put('/:id',  protect, authorize('SUPER_ADMIN'), handleUpload(uploadIcon), updateIcon);
router.delete('/:id', protect, authorize('SUPER_ADMIN'), deleteIcon);

module.exports = router;
