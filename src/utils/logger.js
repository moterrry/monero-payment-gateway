const pino = require('pino');
const config = require('./config');

const logger = pino({
  level: config.logLevel,
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

module.exports = logger;
