const express = require('express');
const router = express.Router();
const simulatorController = require('../controllers/simulator');

router.post('/', simulatorController.simulatePayment);
router.post('/clear', simulatorController.clearTransfers);
router.get('/balance', simulatorController.getBalance);

module.exports = router;
