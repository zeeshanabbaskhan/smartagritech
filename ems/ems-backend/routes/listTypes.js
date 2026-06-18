const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getListTypes, createListType, updateListType, deleteListType,
  getListItems, createListItem, updateListItem, deleteListItem,
} = require('../controllers/listTypeController');

router.use(protect, authorize('SUPER_ADMIN'));

router.route('/')
  .get(getListTypes)
  .post(createListType);

router.route('/:id')
  .put(updateListType)
  .delete(deleteListType);

router.route('/:listTypeId/items')
  .get(getListItems)
  .post(createListItem);

router.route('/:listTypeId/items/:itemId')
  .put(updateListItem)
  .delete(deleteListItem);

module.exports = router;
