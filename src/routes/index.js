const express = require('express');
const router = express.Router();

router.use('/invoices', require('./invoices'));

module.exports = router;
