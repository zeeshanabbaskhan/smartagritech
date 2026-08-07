const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { query } = require('../controllers/chatbotController')

router.use(protect)
router.post('/query', query)

module.exports = router
