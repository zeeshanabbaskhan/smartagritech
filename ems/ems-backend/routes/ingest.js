const express = require('express');
const router = express.Router();
const { ingest, acknowledgeCommand } = require('../controllers/ingestController');
const { deviceIngestLimiter } = require('../middleware/rateLimiter');

router.post('/', deviceIngestLimiter, ingest);
router.post('/command-ack', deviceIngestLimiter, acknowledgeCommand);

module.exports = router;
