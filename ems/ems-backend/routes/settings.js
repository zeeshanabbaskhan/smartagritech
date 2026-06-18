const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const { getSettings, upsertSetting, deleteSetting } = require('../controllers/settingController');

const handleUpload = (middleware) => (req, res, next) =>
  middleware(req, res, (err) => (err ? next(err) : next()));

router.use(protect, authorize('SUPER_ADMIN'));

router.get('/', getSettings);
router.put('/:key', handleUpload(uploadSingle), upsertSetting);
router.delete('/:key', deleteSetting);

module.exports = router;
