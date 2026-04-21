const invoiceService = require('../services/invoice');
const config = require('../utils/config');
const logger = require('../utils/logger');

let workerInterval = null;
let isRunning = false;

async function runWorker() {
  if (isRunning) {
    logger.debug('Worker already running, skipping cycle');
    return;
  }

  isRunning = true;

  try {
    logger.debug('Worker checking invoices for payments');

    const pendingInvoices = invoiceService.getPendingInvoices();
    logger.debug({ count: pendingInvoices.length }, 'Checking pending invoices');

    for (const invoice of pendingInvoices) {
      try {
        await invoiceService.checkAndUpdateInvoice(invoice);
      } catch (error) {
        logger.error({
          invoice_id: invoice.id,
          error: error.message
        }, 'Failed to check invoice');
      }
    }

    invoiceService.updateExpiredInvoices();
  } catch (error) {
    logger.error({ error: error.message }, 'Worker error');
  } finally {
    isRunning = false;
  }
}

function startWorker() {
  if (workerInterval) {
    logger.warn('Worker already running');
    return;
  }

  logger.info({ interval_ms: config.workerIntervalMs }, 'Starting payment worker');

  runWorker();

  workerInterval = setInterval(runWorker, config.workerIntervalMs);
}

function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info('Payment worker stopped');
  }
}

async function runOnce() {
  await runWorker();
}

module.exports = {
  startWorker,
  stopWorker,
  runOnce
};
