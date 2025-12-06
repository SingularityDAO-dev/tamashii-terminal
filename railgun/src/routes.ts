import { Router, Request, Response } from 'express';
import { verify } from '@noble/ed25519';
import { getRailgunWalletAddressData } from '@railgun-community/wallet';
import { getState, getAddress, getEvmAddress, getTransactionHistory } from './railgun';

const router = Router();

// GET /health
router.get('/health', (_req: Request, res: Response) => {
  const state = getState();
  res.json({
    status: 'ok',
    wallet: state.walletId ? 'loaded' : 'not_loaded',
    network: state.networkName,
    scanning: state.isScanning,
    progress: `${(state.scanProgress * 100).toFixed(1)}%`,
  });
});

// GET /address
router.get('/address', (_req: Request, res: Response) => {
  const railgunAddress = getAddress();
  const evmAddress = getEvmAddress();
  if (!railgunAddress) {
    res.status(503).json({ error: 'Wallet not initialized' });
    return;
  }
  res.json({ evmAddress, railgunAddress });
});

// POST /verify
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { message, signature, address } = req.body;
    if (!message || !signature || !address) {
      res.status(400).json({ error: 'message, signature, address required' });
      return;
    }
    const { viewingPublicKey } = getRailgunWalletAddressData(address);
    const valid = await verify(
      Buffer.from(signature.replace('0x', ''), 'hex'),
      new TextEncoder().encode(message),
      viewingPublicKey
    );
    res.json({ valid });
  } catch (error) {
    res.status(400).json({ valid: false, error: 'Invalid address or signature' });
  }
});

// GET /transactions
router.get('/transactions', async (_req: Request, res: Response) => {
  try {
    const history = await getTransactionHistory();
    res.json({ transactions: formatTxs(history) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /transactions/:railgunaddr
router.get('/transactions/:railgunaddr', async (req: Request, res: Response) => {
  try {
    const { railgunaddr } = req.params;
    const history = await getTransactionHistory();
    const filtered = history.filter(tx =>
      tx.receiveERC20Amounts.some(r => r.senderAddress === railgunaddr)
    );
    res.json({ transactions: formatTxs(filtered) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

function formatTxs(txs: any[]) {
  return txs.map(tx => ({
    txid: tx.txid,
    blockNumber: tx.blockNumber,
    timestamp: tx.timestamp,
    category: tx.category,
    received: tx.receiveERC20Amounts.map((r: any) => ({
      token: r.tokenAddress,
      amount: r.amount.toString(),
      from: r.senderAddress,
      memo: r.memoText,
    })),
  }));
}

export default router;
