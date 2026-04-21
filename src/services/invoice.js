const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const moneroService = require('./monero');
const webhookService = require('./webhook');
const { generatePaymentQR } = require('./qrcode');
const config = require('../utils/config');
const logger = require('../utils/logger');

class InvoiceService {
  async createInvoice(amount) {
    const db = getDb();
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + (config.invoiceExpiryMinutes * 60);

    logger.info({ invoice_id: id, amount }, 'Creating new invoice');

    let subaddressData;
    try {
      subaddressData = await moneroService.createSubaddress(0, `Invoice ${id}`);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create subaddress');
      throw new Error('Failed to generate payment address');
    }

    const stmt = db.prepare(`
      INSERT INTO invoices (id, amount, subaddress, subaddress_index, status, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
    `);

    stmt.run(
      id,
      amount,
      subaddressData.address,
      subaddressData.index,
      expiresAt,
      now,
      now
    );

    logger.info({
      invoice_id: id,
      amount,
      subaddress: subaddressData.address,
      expires_in_minutes: config.invoiceExpiryMinutes
    }, 'Invoice created');

    const invoice = this.getInvoice(id);
    const qrCode = await generatePaymentQR(invoice);

    return { ...invoice, qrCode };
  }

  getInvoice(id) {
    const db = getDb();
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);

    if (!invoice) return null;

    return {
      id: invoice.id,
      amount: invoice.amount,
      subaddress: invoice.subaddress,
      subaddressIndex: invoice.subaddress_index,
      status: invoice.status,
      confirmations: invoice.confirmations,
      txHash: invoice.tx_hash,
      expiresAt: invoice.expires_at,
      paidAt: invoice.paid_at,
      confirmedAt: invoice.confirmed_at,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at
    };
  }

  getPendingInvoices() {
    const db = getDb();
    return db.prepare("SELECT * FROM invoices WHERE status IN ('pending', 'paid')").all();
  }

  async checkAndUpdateInvoice(invoice) {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    if (invoice.status === 'expired' || invoice.status === 'confirmed') {
      return invoice;
    }

    if (now > invoice.expires_at && invoice.status !== 'confirmed') {
      db.prepare("UPDATE invoices SET status = 'expired', updated_at = ? WHERE id = ?")
        .run(now, invoice.id);

      logger.info({ invoice_id: invoice.id }, 'Invoice expired');

      return { ...invoice, status: 'expired' };
    }

    const transfersData = await moneroService.getTransfers({
      in: true,
      pool: true
    });

    const allTransfers = [...transfersData.transfers, ...transfersData.pool];

    const payment = allTransfers.find(t => {
      const address = t.address || t.destinations?.[0]?.address;

      if (address !== invoice.subaddress) {
        return false;
      }

      const amountAtomic = t.amount || t.delta_amount || 0;
      const amountFloat = parseFloat(amountAtomic);
      const amountInXMR = amountFloat >= 1e12 ? amountFloat / 1e12 : amountFloat;

      return amountInXMR >= invoice.amount;
    });

    if (!payment) {
      return invoice;
    }

    const previousStatus = invoice.status;
    const txAmountAtomic = payment.amount || payment.delta_amount || 0;
    const txAmountXMR = txAmountAtomic / 1e12;

    let updates = {
      tx_hash: payment.tx_hash || payment.id
    };

    if (invoice.status === 'pending') {
      updates.status = 'paid';
      updates.paid_at = now;

      logger.info({
        invoice_id: invoice.id,
        tx_hash: updates.tx_hash,
        amount_received: txAmountXMR
      }, 'Payment detected');
    }

    if (payment.confirmations >= config.confirmationsRequired) {
      updates.status = 'confirmed';
      updates.confirmations = payment.confirmations;
      updates.confirmed_at = now;

      if (invoice.status !== 'confirmed') {
        logger.info({
          invoice_id: invoice.id,
          confirmations: payment.confirmations
        }, 'Payment confirmed');
      }
    } else {
      updates.confirmations = payment.confirmations;
    }

    const setPart = Object.keys(updates).map(k => {
      if (typeof updates[k] === 'string') {
        return `${k} = '${updates[k].replace(/'/g, "''")}'`;
      }
      return `${k} = ?`;
    }).join(', ');

    const updateValues = Object.values(updates).filter(v => typeof v !== 'string');

    const sql = `UPDATE invoices SET ${setPart}, updated_at = ${now} WHERE id = '${invoice.id}'`;

    db.prepare(sql).run(...updateValues);

    const updatedInvoice = this.getInvoice(invoice.id);

    if (previousStatus === 'pending' && updatedInvoice.status === 'paid') {
      await webhookService.handleInvoiceEvent(updatedInvoice, 'invoice.paid', previousStatus);
    }

    if (updatedInvoice.status === 'confirmed' && previousStatus !== 'confirmed') {
      await webhookService.handleInvoiceEvent(updatedInvoice, 'invoice.confirmed', previousStatus);
    }

    return updatedInvoice;
  }

  updateExpiredInvoices() {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    const result = db.prepare(`
      UPDATE invoices
      SET status = 'expired', updated_at = ?
      WHERE status IN ('pending', 'paid') AND expires_at < ?
    `).run(now, now);

    if (result.changes > 0) {
      logger.info({ count: result.changes }, 'Marked invoices as expired');
    }

    return result.changes;
  }
}

module.exports = new InvoiceService();
