import { NetworkName, isDefined } from "@railgun-community/shared-models";
import { loadWalletByID, unloadWalletByID } from "@railgun-community/wallet";
import { updateCachedTokenData } from "../balance/token-util";
import configDefaults from "../config/config-defaults";
import { loadEngineProvidersForNetwork } from "../engine/engine";
import { WalletCache } from "../models/wallet-models";
import { switchWakuNetwork } from "../waku/connect-waku";
import { saveKeychainFile } from "./wallet-cache";
import { initilizeFreshWallet, reinitWalletForChain } from "./wallet-init";
import { walletManager } from "./wallet-manager";
import { getSaltedPassword } from "./wallet-password";

const railgunWallets: MapType<WalletCache> = {};

export const resetMerkelScan = () => {
  walletManager.merkelScanComplete = false;
};

// export const resetPrivateCache = () => {
//   walletManager.privateBalanceCache = [];
// };

export const resetBalanceScan = () => {
  // resetPrivateCache();
  walletManager.menuLoaded = false;
};
export const resetMenuForScan = () => {
  resetMerkelScan();
  resetBalanceScan();
};

export const switchRailgunNetwork = async (chainName: NetworkName) => {
  try {
    resetMenuForScan();

    walletManager.keyChain.currentNetwork = chainName;
    updateCachedTokenData();
    const { keyChainPath } = configDefaults.engine;
    saveKeychainFile(walletManager.keyChain, keyChainPath);
    
    try {
      await switchWakuNetwork(chainName);
    } catch (wakuError) {
      console.error("Warning: Failed to switch Waku network:", (wakuError as Error)?.message || String(wakuError));
      // Continue even if Waku fails - it's not critical for basic functionality
    }
    
    try {
      await loadEngineProvidersForNetwork(chainName);
    } catch (providerError) {
      const errorMsg = (providerError as Error)?.message || String(providerError);
      throw new Error(`Failed to load engine providers for ${chainName}: ${errorMsg}`);
    }
  } catch (error) {
    // Re-throw with context
    const errorMsg = (error as Error)?.message || String(error);
    throw new Error(`Network switch failed: ${errorMsg}`);
  }
};

export const switchRailgunWallet = async (
  walletName: string,
): Promise<boolean | undefined> => {
  if (!walletManager.keyChain.wallets) {
    return;
  }

  if (walletName === walletManager.activeWalletName) {
    return;
  }

  const _hashedPassword = await getSaltedPassword();

  if (!isDefined(_hashedPassword)) {
    return;
  }
  const {
    railgunWalletID: newRailgunWalletID,
    railgunWalletAddress: newRailgunWalletAddress,
  } = walletManager.keyChain.wallets[walletName];
  walletManager.railgunWalletID = newRailgunWalletID;
  walletManager.railgunWalletAddress = newRailgunWalletAddress;

  unloadWalletByID(walletManager.railgunWalletID);
  resetMenuForScan();

  const newWallet = await loadWalletByID(
    _hashedPassword,
    walletManager.railgunWalletID,
    false,
  );
  console.log(`Loading wallet ${walletName}, Please Wait...`);

  walletManager.keyChain.selectedWallet = walletName;
  walletManager.activeWalletName = walletName;
  // Default to BNB Chain (Binance) if no network is set
  const currentNetwork =
    walletManager.keyChain.currentNetwork ?? NetworkName.BNBChain;
  walletManager.currentActiveWallet =
    walletManager.keyChain.wallets[walletName];
  updateCachedTokenData();
  const { keyChainPath } = configDefaults.engine;
  saveKeychainFile(walletManager.keyChain, keyChainPath);

  await reinitWalletForChain(currentNetwork);
  return true;
};

export const runFreshWalletPrompt = async (chainName: NetworkName) => {
  const newWalletInfo = await initilizeFreshWallet();
  if (isDefined(newWalletInfo)) {
    resetMenuForScan();
    await reinitWalletForChain(chainName);

    return newWalletInfo;
  }
  return undefined;
};
