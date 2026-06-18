const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getListItemsAll, createListItemDirect, updateListItemDirect, deleteListItemDirect } = require('../controllers/listTypeController');

router.use(protect, authorize('SUPER_ADMIN'));

router.get('/',       getListItemsAll);
router.post('/',      createListItemDirect);
router.put('/:id',    updateListItemDirect);
router.delete('/:id', deleteListItemDirect);

module.exports = router;
