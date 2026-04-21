const moneroService = require('../services/monero');
const config = require('../utils/config');

const simulatePayment = async (req, res) => {
  try {
    const { amount, address } = req.body;

    if (!config.demoMode) {
      return res.status(400).json({
        success: false,
        error: 'Simulator only available in demo mode'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address required'
      });
    }

    const result = moneroService.fakeSend(amount, address);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const clearTransfers = async (req, res) => {
  if (!config.demoMode) {
    return res.status(400).json({
      success: false,
      error: 'Simulator only available in demo mode'
    });
  }

  moneroService.clearDemoTransfers();

  res.json({
    success: true,
    message: 'Demo transfers cleared'
  });
};

const getBalance = async (req, res) => {
  if (!config.demoMode) {
    return res.status(400).json({
      success: false,
      error: 'Simulator only available in demo mode'
    });
  }

  const transfers = moneroService.demoIn_transfers;
  const total = transfers.reduce((sum, t) => sum + t.amount, 0) / 1e12;

  res.json({
    balance: total.toFixed(12),
    pending: transfers.filter(t => t.confirmations < config.confirmationsRequired).length,
    confirmed: transfers.filter(t => t.confirmations >= config.confirmationsRequired).length
  });
};

module.exports = {
  simulatePayment,
  clearTransfers,
  getBalance
};
