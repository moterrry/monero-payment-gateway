const invoiceService = require('../services/invoice');
const logger = require('../utils/logger');

const createInvoice = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount. Must be a positive number.'
      });
    }

    const invoice = await invoiceService.createInvoice(amount);

    res.status(201).json(invoice);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create invoice');
    res.status(500).json({
      error: 'Failed to create invoice'
    });
  }
};

const getInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = invoiceService.getInvoice(id);

    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found'
      });
    }

    res.json(invoice);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get invoice');
    res.status(500).json({
      error: 'Failed to get invoice'
    });
  }
};

const listInvoices = async (req, res) => {
  try {
    const db = require('../db').getDb();
    const invoices = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all();
    res.json(invoices);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to list invoices');
    res.status(500).json({
      error: 'Failed to list invoices'
    });
  }
};

module.exports = {
  createInvoice,
  getInvoice,
  listInvoices
};
