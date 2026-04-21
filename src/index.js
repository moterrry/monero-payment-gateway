const express = require('express');
const path = require('path');
const config = require('./utils/config');
const logger = require('./utils/logger');
const { initializeDatabase } = require('./db');
const routes = require('./routes');
const { apiKeyAuth, rateLimiter } = require('./middleware/auth');
const { validateCreateInvoice } = require('./middleware/validation');
const { startWorker } = require('./workers/paymentWatcher');
const moneroService = require('./services/monero');

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  logger.debug({ method: req.method, path: req.path }, 'Incoming request');
  next();
});

app.use(express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.use(rateLimiter({
  windowMs: 60000,
  maxRequests: 100
}));

app.get('/health', async (req, res) => {
  const moneroStatus = await moneroService.testConnection();
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    monero: moneroStatus,
    config: {
      port: config.port,
      invoiceExpiryMinutes: config.invoiceExpiryMinutes,
      confirmationsRequired: config.confirmationsRequired
    }
  });
});

app.use('/api/simulate', require('./routes/simulator'));
app.use('/api/balance', require('./routes/balance'));
app.use('/api/invoices', require('./routes/invoices'));

app.use((err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: err.stack
  }, 'Unhandled error');

  res.status(500).json({
    error: 'Internal server error'
  });
});

async function start() {
  try {
    logger.info('Initializing database...');
    initializeDatabase();

    logger.info('Starting background worker...');
    startWorker();

    logger.info({ port: config.port }, 'Starting HTTP server...');

    app.listen(config.port, () => {
      logger.info({ port: config.port }, 'Server started');
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to start server');
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
