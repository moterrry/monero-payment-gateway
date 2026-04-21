const express = require('express');
const router = express.Router();
const invoicesController = require('../controllers/invoices');

router.post('/', invoicesController.createInvoice);
router.get('/:id', invoicesController.getInvoice);
router.get('/', invoicesController.listInvoices);

module.exports = router;
