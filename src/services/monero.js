const fetch = require('node-fetch');
const config = require('../utils/config');
const logger = require('../utils/logger');

const DEMO_ADDRESSES = new Map();

class MoneroService {
  constructor() {
    this.rpcUrl = config.moneroRpcUrl;
    this.auth = Buffer.from(`${config.moneroRpcUser}:${config.moneroRpcPass}`).toString('base64');
    this.demoIn_transfers = [];
    this.demoIn_pool = [];
  }

  isDemo() {
    return config.demoMode;
  }

  generateDemoAddress(label = 'Payment Gateway') {
    const chars = '13456789abcdefghijkmnopqrstuwyz';
    let address = '4';
    for (let i = 57; i > 0; i--) {
      if (i === 1 || i === 6 || i === 10 || i === 15 || i === 20 || i === 26 || i === 32 || i === 37 || i === 42 || i === 48 || i === 53) {
        address += 'L';
      } else if (i === 29 || i === 33 || i === 45) {
        address += 'A';
      } else {
        address += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    return address;
  }

  async rpcCall(method, params = {}) {
    if (this.isDemo()) {
      return this.demoRpcCall(method, params);
    }

    const response = await fetch(`${this.rpcUrl}/json_rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${this.auth}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '0',
        method,
        ...params
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Monero RPC error: ${response.status} - ${error}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(`Monero RPC error: ${result.error.message}`);
    }

    return result.result;
  }

  demoRpcCall(method, params = {}) {
    switch (method) {
      case 'make_subaddress':
        const address = this.generateDemoAddress(params.label);
        const index = DEMO_ADDRESSES.size;
        DEMO_ADDRESSES.set(address, { index, label: params.label });
        return { address, address_index: index };

      case 'get_transfers':
        return {
          transfers: this.demoIn_transfers,
          pool: this.demoIn_pool
        };

      case 'get_height':
        return { height: 1234567 };

      case 'get_version':
        return { version: 131074 };

      default:
        return {};
    }
  }

  fakeSend(amountXMR, targetAddress) {
    if (!this.isDemo()) {
      throw new Error('fakeSend only works in demo mode');
    }

    const txHash = Array.from({ length: 64 }, () =>
      '0123456789abcdef'[Math.floor(Math.random() * 16)]
    ).join('');

    const demoTransfer = {
      tx_hash: txHash,
      address: targetAddress,
      amount: Math.round(amountXMR * 1e12),
      confirmations: config.confirmationsRequired,
      timestamp: Math.floor(Date.now() / 1000)
    };

    this.demoIn_transfers.push(demoTransfer);

    logger.info({
      amount: amountXMR,
      address: targetAddress,
      tx_hash: txHash,
      confirmations: demoTransfer.confirmations
    }, 'Demo payment simulated');

    return { tx_hash: txHash, amount: amountXMR, confirmations: demoTransfer.confirmations };
  }

  simulateConfirmation(txHash, confirmations) {
    const transfer = this.demoIn_transfers.find(t => t.tx_hash === txHash);
    if (transfer) {
      transfer.confirmations = confirmations;
      return transfer;
    }
    return null;
  }

  clearDemoTransfers() {
    this.demoIn_transfers = [];
    this.demoIn_pool = [];
  }

  async makeJsonRpcRequest(method, params = {}) {
    if (this.isDemo()) {
      return this.demoRpcCall(method, params);
    }

    const response = await fetch(`${this.rpcUrl}/json_rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${this.auth}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '0',
        method,
        params
      })
    });

    if (!response.ok) {
      throw new Error(`Monero RPC error: ${response.status}`);
    }

    return response.json();
  }

  async makeRpcRequest(method, params = {}) {
    if (this.isDemo()) {
      return this.demoRpcCall(method, params);
    }

    const response = await fetch(`${this.rpcUrl}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${this.auth}`
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`Monero RPC error: ${response.status}`);
    }

    return response.json();
  }

  async createSubaddress(accountIndex = 0, label = 'Payment Gateway') {
    const result = await this.rpcCall('make_subaddress', {
      account_index: accountIndex,
      label: label
    });

    logger.debug({
      address: result.address,
      index: result.address_index
    }, 'Created new subaddress');

    return {
      address: result.address,
      index: result.address_index
    };
  }

  async getTransfers(inOptions = {}) {
    const options = {
      in: true,
      pool: true,
      ...inOptions
    };

    if (this.isDemo()) {
      return {
        transfers: this.demoIn_transfers,
        pool: this.demoIn_pool
      };
    }

    try {
      const result = await this.rpcCall('get_transfers', options);
      return {
        transfers: result.transfers || [],
        pool: result.pool || []
      };
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get transfers');
      return { transfers: [], pool: [] };
    }
  }

  async getTransferByTxHash(txHash) {
    if (this.isDemo()) {
      return this.demoIn_transfers.find(t => t.tx_hash === txHash) || null;
    }

    try {
      const result = await this.rpcCall('get_transfer_by_txid', {
        txid: txHash
      });
      return result.transfer || null;
    } catch (error) {
      return null;
    }
  }

  async getHeight() {
    if (this.isDemo()) {
      return 1234567;
    }

    try {
      const result = await this.rpcCall('get_height');
      return result.height;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get height');
      return null;
    }
  }

  async getVersion() {
    if (this.isDemo()) {
      return 131074;
    }

    try {
      const result = await this.rpcCall('get_version');
      return result.version;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get version');
      return null;
    }
  }

  async testConnection() {
    if (this.isDemo()) {
      return { connected: true, version: 131074, height: 1234567, demoMode: true };
    }

    try {
      const version = await this.getVersion();
      const height = await this.getHeight();
      return { connected: true, version, height };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
}

module.exports = new MoneroService();
