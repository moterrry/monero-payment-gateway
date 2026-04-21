const { z } = require('zod');
const logger = require('../utils/logger');

const createInvoiceSchema = z.object({
  amount: z.number().positive('Amount must be positive')
});

const validateCreateInvoice = (req, res, next) => {
  try {
    createInvoiceSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    logger.error({ error: error.message }, 'Validation error');
    res.status(500).json({
      error: 'Internal validation error'
    });
  }
};

module.exports = {
  validateCreateInvoice
};
