require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const prisma = require('./config/database');
const { initSocket } = require('./socket');
const { initScheduler } = require('./services/schedulerService');
const { startValueFlush } = require('./services/valueFlushService');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const metrics = require('./utils/metrics');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(compression());
const corsOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((o) => o.trim())
  : true;
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.on('finish', () => {
    metrics.inc('http_requests_total', {
      method: req.method,
      route:  req.route?.path || req.path.split('?')[0],
      status: String(res.statusCode),
    });
  });
  next();
});

app.use('/api/ingest', require('./routes/ingest'));
app.use('/api', apiLimiter, routes);

app.get('/health', (req, res) => {
  const redis = require('./config/redis');
  const { isQueueEnabled } = require('./workers/jobQueues');
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    redis: redis.isEnabled(),
    ingestMode: isQueueEnabled() ? 'queued' : 'sync',
  });
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics.prometheusText());
});

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

const start = async () => {
  await prisma.$connect()
    .then(() => logger.info('PostgreSQL connected via Prisma'))
    .catch(err => { logger.error('DB connection failed', { message: err.message }); process.exit(1); });

  const { initRedis } = require('./config/redis');
  await initRedis();

  const { initAllQueues, isQueueEnabled } = require('./workers/jobQueues');
  initAllQueues();
  logger.info(isQueueEnabled()
    ? 'Ingest mode: queued (BullMQ batch — production path)'
    : 'Ingest mode: sync (set REDIS_URL and start Redis for batch ingest)');

  startValueFlush();
  initSocket(server, app);
  await initScheduler();

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => logger.info(`Server running on port ${PORT}`));
};

start();
