const crypto = require('crypto');
const axios = require('axios');
const { getDb } = require('../db');
const config = require('../utils/config');
const logger = require('../utils/logger');

class WebhookService {
  generateSignature(payload, secret) {
    return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }

  async deliverWebhook(webhook, event, data) {
    const db = getDb();
    const payload = {
      event,
      invoice_id: data.id,
      amount: data.amount,
      status: data.status,
      subaddress: data.subaddress,
      tx_hash: data.tx_hash,
      confirmations: data.confirmations,
      timestamp: Date.now()
    };

    const signature = webhook.secret ? this.generateSignature(payload, webhook.secret) : '';

    let lastError = null;
    let lastResponseCode = null;

    for (let attempt = 1; attempt <= config.webhookRetryAttempts; attempt++) {
      try {
        logger.info({
          webhook_id: webhook.id,
          event,
          invoice_id: data.id,
          attempt
        }, 'Delivering webhook');

        const response = await axios.post(webhook.url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event
          },
          timeout: 30000
        });

        lastResponseCode = response.status;

        db.prepare(`
          INSERT INTO webhook_deliveries (webhook_id, invoice_id, event, status, attempts, response_code)
          VALUES (?, ?, ?, 'success', ?, ?)
        `).run(webhook.id, data.id, event, attempt, response.status);

        logger.info({
          webhook_id: webhook.id,
          event,
          invoice_id: data.id,
          status_code: response.status
        }, 'Webhook delivered successfully');

        return { success: true };
      } catch (error) {
        lastError = error.message;
        lastResponseCode = error.response?.status;

        logger.warn({
          webhook_id: webhook.id,
          event,
          invoice_id: data.id,
          attempt,
          error: error.message
        }, 'Webhook delivery failed, retrying...');

        if (attempt < config.webhookRetryAttempts) {
          await new Promise(resolve => setTimeout(resolve, config.webhookRetryDelay));
        }
      }
    }

    db.prepare(`
      INSERT INTO webhook_deliveries (webhook_id, invoice_id, event, status, attempts, response_code, error)
      VALUES (?, ?, ?, 'failed', ?, ?, ?)
    `).run(webhook.id, data.id, event, config.webhookRetryAttempts, lastResponseCode, lastError);

    logger.error({
      webhook_id: webhook.id,
      event,
      invoice_id: data.id,
      error: lastError
    }, 'Webhook delivery failed after all retries');

    return { success: false, error: lastError };
  }

  async handleInvoiceEvent(invoice, event, previousStatus) {
    const db = getDb();

    const webhooks = db.prepare(`
      SELECT w.*, ak.key as api_key
      FROM webhooks w
      JOIN api_keys ak ON w.api_key_id = ak.id
      WHERE w.active = 1 AND w.events LIKE ?
    `).all(`%${event}%`);

    if (webhooks.length === 0) {
      logger.debug({ invoice_id: invoice.id, event }, 'No webhooks configured for event');
      return;
    }

    const results = await Promise.all(
      webhooks.map(webhook => this.deliverWebhook(webhook, event, invoice))
    );

    const successCount = results.filter(r => r.success).length;
    logger.info({
      invoice_id: invoice.id,
      event,
      sent: successCount,
      failed: results.length - successCount
    }, 'Webhook event processed');
  }

  getActiveWebhooks(apiKeyId = null) {
    const db = getDb();
    let query = 'SELECT * FROM webhooks WHERE active = 1';
    const params = [];

    if (apiKeyId) {
      query += ' AND api_key_id = ?';
      params.push(apiKeyId);
    }

    return db.prepare(query).all(...params);
  }

  registerWebhook(apiKeyId, url, events, secret = null) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO webhooks (api_key_id, url, events, secret)
      VALUES (?, ?, ?, ?)
    `).run(apiKeyId, url, events.join(','), secret);

    return result.lastInsertRowid;
  }
}

module.exports = new WebhookService();
