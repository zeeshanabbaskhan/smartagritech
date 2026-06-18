const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const { getProducts, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');

const handleUpload = (middleware) => (req, res, next) =>
  middleware(req, res, (err) => (err ? next(err) : next()));

router.get('/', getProducts); // public

router.post('/',    protect, authorize('SUPER_ADMIN'), handleUpload(uploadSingle), createProduct);
router.put('/:id',  protect, authorize('SUPER_ADMIN'), handleUpload(uploadSingle), updateProduct);
router.delete('/:id', protect, authorize('SUPER_ADMIN'), deleteProduct);

module.exports = router;
