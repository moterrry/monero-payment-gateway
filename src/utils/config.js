const config = {
  moneroRpcUrl: process.env.MONERO_RPC_URL || 'http://localhost:18081',
  moneroRpcUser: process.env.MONERO_RPC_USER || 'user',
  moneroRpcPass: process.env.MONERO_RPC_PASS || 'pass',
  confirmationsRequired: parseInt(process.env.CONFIRMATIONS_REQUIRED || '10', 10),
  apiKeys: (process.env.API_KEYS || '').split(',').filter(k => k.trim()),
  databaseUrl: process.env.DATABASE_URL || './data/payments.db',
  webhookRetryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3', 10),
  webhookRetryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '1000', 10),
  invoiceExpiryMinutes: parseInt(process.env.INVOICE_EXPIRY_MINUTES || '60', 10),
  workerIntervalMs: parseInt(process.env.WORKER_INTERVAL_MS || '15000', 10),
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  demoMode: process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === '1',
};

module.exports = config;
