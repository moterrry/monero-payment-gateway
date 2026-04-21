const { getDb } = require('../db');
const logger = require('../utils/logger');

const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing API key'
    });
  }

  const db = getDb();
  const keyRecord = db.prepare('SELECT * FROM api_keys WHERE key = ? AND active = 1').get(apiKey);

  if (!keyRecord) {
    logger.warn({ api_key: apiKey }, 'Invalid API key attempt');
    return res.status(401).json({
      error: 'Invalid API key'
    });
  }

  req.apiKey = keyRecord;
  next();
};

const rateLimitMap = new Map();

const rateLimiter = (options = {}) => {
  const {
    windowMs = 60000,
    maxRequests = 100
  } = options;

  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.ip || 'unknown';
    const now = Date.now();

    if (!rateLimitMap.has(apiKey)) {
      rateLimitMap.set(apiKey, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    const record = rateLimitMap.get(apiKey);

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    if (record.count >= maxRequests) {
      logger.warn({ api_key: apiKey, count: record.count }, 'Rate limit exceeded');
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retry_after_ms: record.resetTime - now
      });
    }

    record.count++;
    next();
  };
};

module.exports = {
  apiKeyAuth,
  rateLimiter
};
