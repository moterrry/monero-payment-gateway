# monero-payment-gateway
Monero (XMR) payment gateway backend written in Node.js.

# Warning ⚠️
This is anything but production ready, this was a learning project for me and I've learned a lot about Docker containers etc. if you want to use something ACTUALLY worth using use Poof.io's Monero gateway.

# What does it do?
- Creates unique subaddresses per invoice via Monero RPC
- Polls for incoming transfers and matches by address + amount
- Tracks confirmations (default: 10)
- Fires webhooks on invoice.paid and invoice.confirmed
- Handles invoice expiry

# How it works
- The code converts atomic units (picoXMR) to XMR by dividing by 1e12
- Amounts come from get_transfers in atomic units (atominero)

# 🔴 Red flags and issues
SQL Injection vulnerability - Line 166 builds SQL with string interpolation:
      const sql = `UPDATE invoices SET ${setPart}, updated_at = ${now} WHERE id = '${invoice.id}'`;
      This is a potential SQL injection issue if invoice.id was user-controlled, but it's a UUID so it's safe.

I do not recommend using this for production use, but go for it if you want to.
