import leveldown from 'leveldown';
import {
  startRailgunEngine,
  stopRailgunEngine,
  createRailgunWallet,
  loadWalletByID,
  getRailgunAddress,
  loadProvider,
  refreshBalances,
  getWalletTransactionHistory,
  setOnBalanceUpdateCallback,
  setOnUTXOMerkletreeScanCallback,
} from '@railgun-community/wallet';
import {
  NetworkName,
  NETWORK_CONFIG,
  FallbackProviderJsonConfig,
  RailgunBalancesEvent,
  MerkletreeScanUpdateEvent,
  MerkletreeScanStatus,
  TransactionHistoryItem,
} from '@railgun-community/shared-models';
import { Wallet } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Simple logger with timestamps
function log(category: string, message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${category}] ${message}`);
}

function logBox(title: string, lines: string[]) {
  const maxLen = Math.max(title.length, ...lines.map(l => l.length)) + 4;
  const border = '═'.repeat(maxLen);
  console.log(`\n╔${border}╗`);
  console.log(`║  ${title.padEnd(maxLen - 2)}║`);
  console.log(`╠${border}╣`);
  lines.forEach(line => console.log(`║  ${line.padEnd(maxLen - 2)}║`));
  console.log(`╚${border}╝\n`);
}

interface RailgunState {
  walletId: string | null;
  railgunAddress: string | null;
  evmAddress: string | null;
  networkName: NetworkName;
  isScanning: boolean;
  scanProgress: number;
  scanStatus: string;
  lastBalances: RailgunBalancesEvent | null;
  dbPath: string | null;
  artifactPath: string | null;
  rpcUrl: string | null;
}

const state: RailgunState = {
  walletId: null,
  railgunAddress: null,
  evmAddress: null,
  networkName: NetworkName.Polygon,
  isScanning: false,
  scanProgress: 0,
  scanStatus: 'idle',
  lastBalances: null,
  dbPath: null,
  artifactPath: null,
  rpcUrl: null,
};

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || './artifacts';
const DB_DIR = process.env.DB_DIR || './railgun-db';
const WALLET_ID_FILE = path.join(DB_DIR, '.wallet_id');

const artifactStore = {
  get: async (filePath: string): Promise<string | Buffer | null> => {
    const fullPath = path.join(ARTIFACT_DIR, filePath);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath);
    }
    return null;
  },
  store: async (dir: string, filePath: string, data: string | Uint8Array): Promise<void> => {
    const fullPath = path.join(ARTIFACT_DIR, dir, filePath);
    const dirPath = path.dirname(fullPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(fullPath, data);
  },
  exists: async (filePath: string): Promise<boolean> => {
    const fullPath = path.join(ARTIFACT_DIR, filePath);
    return fs.existsSync(fullPath);
  },
};

export async function initRailgun(): Promise<void> {
  const mnemonic = process.env.MNEMONIC;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const rpcUrl = process.env.RPC_URL;
  const networkName = (process.env.NETWORK_NAME as NetworkName) || NetworkName.Polygon;

  if (!mnemonic) throw new Error('MNEMONIC env var required');
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY env var required');
  if (!rpcUrl) throw new Error('RPC_URL env var required');

  state.networkName = networkName;
  state.dbPath = path.resolve(DB_DIR);
  state.artifactPath = path.resolve(ARTIFACT_DIR);
  state.rpcUrl = rpcUrl;

  // Derive EVM address from mnemonic
  state.evmAddress = Wallet.fromPhrase(mnemonic).address;

  log('INIT', '═══════════════════════════════════════════════════════');
  log('INIT', '  RAILGUN Payment Backend Starting...');
  log('INIT', '═══════════════════════════════════════════════════════');

  // Ensure directories exist
  const dbExists = fs.existsSync(DB_DIR);
  const artifactExists = fs.existsSync(ARTIFACT_DIR);

  if (!dbExists) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    log('DB', `Created database directory: ${state.dbPath}`);
  } else {
    log('DB', `Using existing database: ${state.dbPath}`);
  }

  if (!artifactExists) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    log('ARTIFACT', `Created artifact directory: ${state.artifactPath}`);
  } else {
    log('ARTIFACT', `Using existing artifacts: ${state.artifactPath}`);
  }

  const db = leveldown(DB_DIR);

  log('ENGINE', 'Starting RAILGUN engine...');
  log('ENGINE', `  Network: ${networkName}`);
  log('ENGINE', `  RPC: ${rpcUrl.substring(0, 40)}...`);

  await startRailgunEngine(
    'paymentbackend',
    db,
    true,
    artifactStore,
    false, // useNativeArtifacts - false for Node.js
    false, // skipMerkletreeScans
    ['https://poi-node.railgun.org'],
  );
  log('ENGINE', 'RAILGUN engine started successfully');

  // Set up callbacks
  setOnBalanceUpdateCallback((balancesEvent: RailgunBalancesEvent) => {
    const tokenCount = balancesEvent.erc20Amounts.length;
    log('BALANCE', `Balance update received - ${tokenCount} token(s)`);
    state.lastBalances = balancesEvent;

    if (tokenCount > 0) {
      balancesEvent.erc20Amounts.forEach((token) => {
        log('BALANCE', `  ${token.tokenAddress.substring(0, 10)}...: ${token.amount.toString()}`);
      });
    }
  });

  setOnUTXOMerkletreeScanCallback((scanData: MerkletreeScanUpdateEvent) => {
    state.isScanning = scanData.scanStatus === MerkletreeScanStatus.Started ||
                       scanData.scanStatus === MerkletreeScanStatus.Updated;
    state.scanProgress = scanData.progress;
    state.scanStatus = MerkletreeScanStatus[scanData.scanStatus] || 'unknown';

    const pct = (scanData.progress * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(scanData.progress * 20)) + '░'.repeat(20 - Math.floor(scanData.progress * 20));
    log('SYNC', `[${bar}] ${pct}% - ${state.scanStatus}`);
  });

  // Load or create wallet
  const savedWalletId = loadSavedWalletId();
  if (savedWalletId) {
    log('WALLET', 'Loading existing wallet from database...');
    const walletInfo = await loadWalletByID(encryptionKey, savedWalletId, false);
    state.walletId = walletInfo.id;
    log('WALLET', `Wallet loaded: ${walletInfo.id.substring(0, 16)}...`);
  } else {
    log('WALLET', 'Creating new RAILGUN wallet...');
    const walletInfo = await createRailgunWallet(encryptionKey, mnemonic, undefined);
    state.walletId = walletInfo.id;
    saveWalletId(walletInfo.id);
    log('WALLET', `New wallet created: ${walletInfo.id.substring(0, 16)}...`);
  }

  state.railgunAddress = getRailgunAddress(state.walletId) || null;

  // Display wallet info box
  const network = NETWORK_CONFIG[networkName];
  logBox('WALLET ADDRESSES', [
    `Network:  ${networkName} (Chain ID: ${network.chain.id})`,
    ``,
    `EVM Address (public):`,
    `  ${state.evmAddress}`,
    ``,
    `RAILGUN Address (private):`,
    `  ${state.railgunAddress}`,
    ``,
    `Share the RAILGUN address to receive private payments!`,
  ]);

  // Load provider (weight must be >= 2 for fallback quorum)
  const providerConfig: FallbackProviderJsonConfig = {
    chainId: network.chain.id,
    providers: [
      {
        provider: rpcUrl,
        priority: 1,
        weight: 2,
        stallTimeout: 5000,
        maxLogsPerBatch: 1, // Smallest batch to avoid block range errors
      },
    ],
  };

  log('PROVIDER', `Connecting to ${networkName}...`);
  // Longer polling interval (60s) to reduce RPC calls
  await loadProvider(providerConfig, networkName, 60000);
  log('PROVIDER', 'Provider connected successfully');

  // Start initial scan
  log('SYNC', 'Starting merkletree sync (this may take a while on first run)...');
  const chain = network.chain;
  await refreshBalances(chain, [state.walletId]);
  log('SYNC', 'Initial sync started in background');
}

export async function shutdown(): Promise<void> {
  log('SHUTDOWN', 'Shutting down RAILGUN engine...');
  await stopRailgunEngine();
  log('SHUTDOWN', 'Engine stopped. Goodbye!');
}

export function getState(): RailgunState {
  return { ...state };
}

export function getAddress(): string | null {
  return state.railgunAddress;
}

export function getEvmAddress(): string | null {
  return state.evmAddress;
}

export async function getTransactionHistory(startingBlock?: number): Promise<TransactionHistoryItem[]> {
  if (!state.walletId) throw new Error('Wallet not initialized');
  const network = NETWORK_CONFIG[state.networkName];
  return getWalletTransactionHistory(network.chain, state.walletId, startingBlock);
}

function loadSavedWalletId(): string | null {
  if (fs.existsSync(WALLET_ID_FILE)) {
    return fs.readFileSync(WALLET_ID_FILE, 'utf-8').trim();
  }
  return null;
}

function saveWalletId(walletId: string): void {
  fs.writeFileSync(WALLET_ID_FILE, walletId);
}
