import express from 'express';
import routes from './routes';
import { initRailgun, shutdown } from './railgun';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/', routes);

async function main() {
  console.log('Initializing RAILGUN Payment Backend...');

  try {
    await initRailgun();
    console.log('RAILGUN initialized successfully');
  } catch (error) {
    console.error('Failed to initialize RAILGUN:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Endpoints:`);
    console.log(`  GET  /health           - Service health`);
    console.log(`  GET  /address          - RAILGUN + EVM addresses`);
    console.log(`  GET  /evm/balance      - Public EVM balance`);
    console.log(`  GET  /evm/transactions - Public EVM transactions`);
    console.log(`  GET  /balance          - Shielded balances`);
    console.log(`  GET  /balance/:token   - Shielded token balance`);
    console.log(`  GET  /transactions     - Private transaction history`);
    console.log(`  GET  /incoming         - Incoming private payments`);
    console.log(`  POST /scan             - Trigger rescan`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await shutdown();
  process.exit(0);
});

main().catch(console.error);
