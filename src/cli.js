const readline = require('readline');
const moneroService = require('./services/monero');
const config = require('./utils/config');
const logger = require('./utils/logger');

const HELP = `
Monero Payment Gateway CLI
======================
Commands:
  xmr send <amount> <address>  - Simulate sending XMR (demo mode only)
  xmr balance                 - Show balance (demo mode)
  xmr clear                   - Clear demo transfers
  help                        - Show this help
  quit / exit                 - Exit CLI
`;

function startCLI() {
  if (!config.demoMode) {
    logger.info('CLI only available in demo mode (set DEMO_MODE=true)');
    return;
  }

  console.log('\n=== Monero Payment Gateway CLI (Demo Mode) ===\n');
  console.log('Type "help" for commands\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = () => {
    rl.question('xmr> ', async (input) => {
      const parts = input.trim().toLowerCase().split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);

      try {
        switch (cmd) {
          case 'send':
            if (args.length < 2) {
              console.log('Usage: xmr send <amount> <address>');
              console.log('Example: xmr send 0.5 4ABCD...');
            } else {
              const amount = parseFloat(args[0]);
              const address = args[1];
              if (isNaN(amount) || amount <= 0) {
                console.log('Error: Invalid amount');
              } else {
                const result = moneroService.fakeSend(amount, address);
                console.log(`✓ Sent ${amount} XMR to ${address}`);
                console.log(`  TX Hash: ${result.tx_hash}`);
                console.log(`  Confirmations: ${result.confirmations}/${config.confirmationsRequired}`);
              }
            }
            break;

          case 'balance':
            const transfers = moneroService.demoIn_transfers;
            const total = transfers.reduce((sum, t) => sum + t.amount, 0) / 1e12;
            console.log(`Balance: ${total} XMR`);
            console.log(`Pending: ${transfers.filter(t => t.confirmations < config.confirmationsRequired).length} tx`);
            console.log(`Confirmed: ${transfers.filter(t => t.confirmations >= config.confirmationsRequired).length} tx`);
            break;

          case 'clear':
            moneroService.clearDemoTransfers();
            console.log('Demo transfers cleared');
            break;

          case 'help':
            console.log(HELP);
            break;

          case 'quit':
          case 'exit':
            console.log('Goodbye!');
            rl.close();
            return;

          case '':
            break;

          default:
            console.log(`Unknown command: ${cmd}`);
            console.log('Type "help" for available commands');
        }
      } catch (error) {
        console.log(`Error: ${error.message}`);
      }

      prompt();
    });
  };

  prompt();
}

if (require.main === module) {
  startCLI();
}

module.exports = { startCLI };
