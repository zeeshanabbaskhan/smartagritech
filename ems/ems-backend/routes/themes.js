const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getThemes, createTheme, updateTheme, deleteTheme, assignTheme } = require('../controllers/themeController');

router.use(protect, authorize('SUPER_ADMIN'));

router.get('/',    getThemes);
router.post('/',   createTheme);
router.put('/:id', updateTheme);
router.delete('/:id', deleteTheme);
router.post('/:id/assign', assignTheme);

module.exports = router;
