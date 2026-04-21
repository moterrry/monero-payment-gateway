const API_BASE = window.location.origin;

const HELP = `Monero Payment Gateway CLI
Commands:
  send <amount> <address>  - Simulate sending XMR
  balance                 - Show balance
  clear                   - Clear demo transfers
  help                    - Show this help`;

class Dashboard {
  constructor() {
    this.currentView = 'dashboard';
    this.simulatorHistory = [HELP];
    this.invoices = [];
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadStatus();
    await this.loadInvoices();
    this.startPolling();
  }

  bindEvents() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchView(item.dataset.view);
      });
    });

    document.getElementById('newInvoiceBtn')?.addEventListener('click', () => {
      this.switchView('create');
    });

    document.getElementById('refreshInvoicesBtn')?.addEventListener('click', () => {
      this.loadInvoices();
    });

    document.getElementById('createInvoiceForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.createInvoice();
    });

    document.getElementById('copyAddressBtn')?.addEventListener('click', () => {
      const address = document.getElementById('resultAddress').textContent;
      navigator.clipboard.writeText(address);
    });

    document.getElementById('simulatorInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.runSimulatorCommand(e.target.value);
        e.target.value = '';
      }
    });

    document.getElementById('quickSendBtn').addEventListener('click', () => {
      const address = document.getElementById('quickAddress').value;
      const amount = parseFloat(document.getElementById('quickAmount').value);
      if (address && amount > 0) {
        this.simulatePayment(amount, address);
        document.getElementById('quickAddress').value = '';
        document.getElementById('quickAmount').value = '';
      }
    });

    document.getElementById('loadInvoiceBtn').addEventListener('click', () => {
      document.getElementById('loadInvoiceModal').classList.add('open');
    });

    document.getElementById('loadModalClose').addEventListener('click', () => {
      document.getElementById('loadInvoiceModal').classList.remove('open');
    });

    document.querySelector('#loadInvoiceModal .modal-backdrop').addEventListener('click', () => {
      document.getElementById('loadInvoiceModal').classList.remove('open');
    });

    document.getElementById('loadInvoiceSubmitBtn').addEventListener('click', async () => {
      const id = document.getElementById('loadInvoiceId').value;
      if (id) {
        await this.loadInvoiceById(id);
        document.getElementById('loadInvoiceModal').classList.remove('open');
      }
    });

    document.getElementById('modalClose').addEventListener('click', () => {
      document.getElementById('invoiceModal').classList.remove('open');
    });

    document.querySelector('#invoiceModal .modal-backdrop').addEventListener('click', () => {
      document.getElementById('invoiceModal').classList.remove('open');
    });
  }

  switchView(viewName) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    document.querySelectorAll('.view').forEach(view => {
      view.classList.toggle('active', view.id === `${viewName}View`);
    });

    this.currentView = viewName;

    if (viewName === 'settings') {
      this.loadSettings();
    }
  }

  async loadStatus() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();

      const statusBadge = document.getElementById('statusBadge');
      if (data.monero?.connected) {
        statusBadge.className = 'header-status connected';
        statusBadge.querySelector('.status-text').textContent = 'Connected';
      } else {
        statusBadge.className = 'header-status disconnected';
        statusBadge.querySelector('.status-text').textContent = data.monero?.demoMode ? 'Demo Mode' : 'Disconnected';
      }

      const demoBanner = document.getElementById('demoBanner');
      demoBanner.style.display = data.monero?.demoMode ? 'flex' : 'none';
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  }

  async loadInvoices() {
    try {
      const res = await fetch(`${API_BASE}/api/invoices`);
      this.invoices = await res.json();
      this.renderInvoices();
      this.updateStats();
    } catch (error) {
      console.error('Failed to load invoices:', error);
    }
  }

  renderInvoices() {
    const tbody = document.getElementById('invoicesTableBody');

    if (!this.invoices.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No invoices yet</td></tr>';
      return;
    }

    tbody.innerHTML = this.invoices.map(inv => `
      <tr>
        <td><code>${inv.id?.slice(0, 8)}...</code></td>
        <td>${inv.amount} XMR</td>
        <td><code>${inv.subaddress?.slice(0, 12)}...</code></td>
        <td><span class="status-badge ${inv.status}">${inv.status}</span></td>
        <td>${this.formatExpiry(inv.expires_at)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="dashboard.showInvoiceModal('${inv.id}')">View</button>
        </td>
      </tr>
    `).join('');
  }

  updateStats() {
    const total = this.invoices.length;
    const pending = this.invoices.filter(i => i.status === 'pending').length;
    const paid = this.invoices.filter(i => i.status === 'paid').length;
    const confirmed = this.invoices.filter(i => i.status === 'confirmed').length;

    document.getElementById('totalInvoices').textContent = total;
    document.getElementById('pendingInvoices').textContent = pending;
    document.getElementById('paidInvoices').textContent = paid;
    document.getElementById('confirmedInvoices').textContent = confirmed;
  }

  formatExpiry(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = date - now;

    if (diff < 0) return 'Expired';

    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;

    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  }

  async createInvoice() {
    const amount = parseFloat(document.getElementById('amount').value);
    const btn = document.querySelector('#createInvoiceForm button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      const res = await fetch(`${API_BASE}/api/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });

      const invoice = await res.json();

      document.getElementById('resultId').textContent = invoice.id;
      document.getElementById('resultAmount').textContent = `${invoice.amount} XMR`;
      document.getElementById('resultAddress').textContent = invoice.subaddress;
      document.getElementById('resultExpires').textContent = this.formatExpiry(invoice.expiresAt);
      document.getElementById('resultStatus').textContent = invoice.status;
      document.getElementById('resultStatus').className = `status-badge ${invoice.status}`;

      if (invoice.qrCode) {
        document.getElementById('resultQR').src = invoice.qrCode;
      }

      document.getElementById('invoiceResult').classList.remove('hidden');
      document.getElementById('createInvoiceForm').reset();
      await this.loadInvoices();
    } catch (error) {
      alert('Failed to create invoice: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l4-4 4 4M7 5v8"/></svg> Create Invoice`;
    }
  }

  async showInvoiceModal(id) {
    try {
      const res = await fetch(`${API_BASE}/api/invoices/${id}`);
      const invoice = await res.json();

      const modalBody = document.getElementById('modalBody');
      modalBody.innerHTML = `
        <div class="invoice-details">
          <div class="detail-row">
            <span class="detail-label">ID</span>
            <code class="detail-value">${invoice.id}</code>
          </div>
          <div class="detail-row">
            <span class="detail-label">Amount</span>
            <span class="detail-value">${invoice.amount} XMR</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Payment Address</span>
            <code class="detail-value address">${invoice.subaddress}</code>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status</span>
            <span class="status-badge ${invoice.status}">${invoice.status}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Confirmations</span>
            <span class="detail-value">${invoice.confirmations || 0} / 10</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Expires</span>
            <span class="detail-value">${this.formatExpiry(invoice.expiresAt)}</span>
          </div>
          ${invoice.txHash ? `
          <div class="detail-row">
            <span class="detail-label">TX Hash</span>
            <code class="detail-value address">${invoice.txHash}</code>
          </div>
          ` : ''}
        </div>
      `;

      document.getElementById('invoiceModal').classList.add('open');
    } catch (error) {
      alert('Failed to load invoice: ' + error.message);
    }
  }

  async loadInvoiceById(id) {
    try {
      const res = await fetch(`${API_BASE}/api/invoices/${id}`);
      if (!res.ok) {
        alert('Invoice not found');
        return;
      }
      this.switchView('dashboard');
      await this.loadInvoices();
      this.showInvoiceModal(id);
    } catch (error) {
      alert('Failed to load invoice: ' + error.message);
    }
  }

  runSimulatorCommand(input) {
    const parts = input.trim().toLowerCase().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    this.addSimulatorLine(`> ${input}`, 'prompt');

    switch (cmd) {
      case 'send':
        if (args.length < 2) {
          this.addSimulatorLine('Usage: send <amount> <address>', 'error');
        } else {
          const amount = parseFloat(args[0]);
          const address = args[1];
          this.simulatePayment(amount, address);
        }
        break;

      case 'balance':
        this.showBalance();
        break;

      case 'clear':
        this.clearDemoTransfers();
        break;

      case 'help':
        HELP.split('\n').forEach(line => this.addSimulatorLine(line, 'system'));
        break;

      default:
        if (cmd) {
          this.addSimulatorLine(`Unknown command: ${cmd}`, 'error');
        }
    }

    this.scrollSimulatorOutput();
  }

  async simulatePayment(amount, address) {
    try {
      const res = await fetch(`${API_BASE}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, address })
      });

      const result = await res.json();

      if (result.success) {
        this.addSimulatorLine(`✓ Sent ${amount} XMR to ${address}`, 'success');
        this.addSimulatorLine(`  TX Hash: ${result.tx_hash}`, 'system');
        this.addSimulatorLine(`  Confirmations: ${result.confirmations}/10`, 'system');
      } else {
        this.addSimulatorLine(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      this.addSimulatorLine(`Error: ${error.message}`, 'error');
    }
  }

  async showBalance() {
    try {
      const res = await fetch(`${API_BASE}/api/balance`);
      const data = await res.json();

      this.addSimulatorLine(`Balance: ${data.balance} XMR`, 'system');
      this.addSimulatorLine(`Pending: ${data.pending} tx`, 'system');
      this.addSimulatorLine(`Confirmed: ${data.confirmed} tx`, 'system');
    } catch (error) {
      this.addSimulatorLine(`Error: ${error.message}`, 'error');
    }
  }

  async clearDemoTransfers() {
    try {
      await fetch(`${API_BASE}/api/simulate/clear`, { method: 'POST' });
      this.addSimulatorLine('Demo transfers cleared', 'success');
    } catch (error) {
      this.addSimulatorLine(`Error: ${error.message}`, 'error');
    }
  }

  addSimulatorLine(text, type = 'system') {
    const output = document.getElementById('simulatorOutput');
    const line = document.createElement('div');
    line.className = `sim-line ${type}`;
    line.textContent = text;
    output.appendChild(line);
  }

  scrollSimulatorOutput() {
    const output = document.getElementById('simulatorOutput');
    output.scrollTop = output.scrollHeight;
  }

  async loadSettings() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();

      document.getElementById('moneroNodeStatus').textContent = data.monero?.connected ? 'Connected' : (data.monero?.demoMode ? 'Demo Mode' : 'Disconnected');
      document.getElementById('demoModeStatus').textContent = data.monero?.demoMode ? 'Enabled' : 'Disabled';
      document.getElementById('confirmationsRequired').textContent = data.config?.confirmationsRequired || '-';

      if (data.config) {
        document.getElementById('invoiceExpiry').textContent = data.config.invoiceExpiryMinutes ? `${data.config.invoiceExpiryMinutes} minutes` : '-';
        document.getElementById('apiPort').textContent = data.config.port || '-';
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  startPolling() {
    setInterval(async () => {
      await this.loadStatus();
      if (this.currentView === 'dashboard') {
        await this.loadInvoices();
      }
    }, 5000);
  }
}

const dashboard = new Dashboard();
