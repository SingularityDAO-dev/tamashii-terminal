import {
  loadProvider,
  startRailgunEngine,
  stopRailgunEngine,
  getProver,
  SnarkJSGroth16 as Groth16,
  pauseAllPollingProviders,
  resumeIsolatedPollingProviderForNetwork,
  refreshBalances as scanUpdatesForMerkletreeAndWallets,
  setLoggers,
} from "@railgun-community/wallet";
import {
  FallbackProviderJsonConfig,
  FeesSerialized,
  NetworkName,
  getAvailableProviderJSONs,
  isDefined,
  removeUndefineds,
} from "@railgun-community/shared-models";
import { groth16 } from "snarkjs";
import configDefaults from "../config/config-defaults";
import LevelDOWN from "leveldown";
import { createArtifactStore } from "../db/artifact-store";
import { setRailgunFees } from "@railgun-community/cookbook";
import { getChainForName, remoteConfig } from "../network/network-util";
import { getProviderObjectFromURL } from "../models/network-models";
import { walletManager } from "../wallet/wallet-manager";
import { saveKeychainFile } from "../wallet/wallet-cache";

const RAILGUN_DB_PATH = configDefaults.engine.databasePath;
const RAILGUN_ARTIFACT_PATH = configDefaults.engine.artifactPath;

let railgunEngineRunning = false;
export const isEngineRunning = () => {
  return railgunEngineRunning;
};

const interceptLog = {
  log: (log: string) => { },
  error: (err: any) => {
    const errorMessage = err?.message || String(err);
    
    // Silently suppress "Failed to scan V2 events" errors
    if (errorMessage.includes("Failed to scan V2 events") || 
        errorMessage.includes("V2 events")) {
      // Completely suppress these errors - no logging
      return;
    }
    
    // Log other errors normally
    console.log(err.message);
  },
};

export const getCustomProviders = () => {
  return walletManager.keyChain.customProviders;
};

export const removeCustomProvider = (
  chainName: NetworkName,
  rpcURL: string,
) => {
  const chain = getChainForName(chainName);

  if (isDefined(walletManager.keyChain.customProviders)) {
    delete walletManager.keyChain.customProviders[chain.type][chain.id][rpcURL];
    const { keyChainPath } = configDefaults.engine;
    saveKeychainFile(walletManager.keyChain, keyChainPath);
  }
};

export const setCustomProviderStatus = (
  chainName: NetworkName,
  rpcURL: string,
  enabled: boolean,
) => {
  const chain = getChainForName(chainName);

  if (!isDefined(walletManager.keyChain.customProviders)) {
    walletManager.keyChain.customProviders = {};
    walletManager.keyChain.customProviders[chain.type] ??= {};
    walletManager.keyChain.customProviders[chain.type][chain.id] ??= {};
  }

  walletManager.keyChain.customProviders[chain.type][chain.id][rpcURL] =
    enabled;

  const { keyChainPath } = configDefaults.engine;
  saveKeychainFile(walletManager.keyChain, keyChainPath);
};

export const getCustomProvidersForChain = (
  chainName: NetworkName,
): MapType<boolean> | undefined => {
  const chain = getChainForName(chainName);
  const customProviders = getCustomProviders();
  if (!isDefined(customProviders)) {
    return undefined;
  }

  if (!isDefined(customProviders[chain.type])) {
    customProviders[chain.type] ??= {};
    customProviders[chain.type][chain.id] ??= {};
    const { keyChainPath } = configDefaults.engine;
    saveKeychainFile(walletManager.keyChain, keyChainPath);
  }

  const chainProviders = customProviders[chain.type][chain.id];

  return chainProviders;
};

export const initRailgunEngine = async () => {
  if (isEngineRunning()) {
    return;
  }
  const engineDatabase = new LevelDOWN(RAILGUN_DB_PATH);
  const artifactStorage = createArtifactStore(RAILGUN_ARTIFACT_PATH);
  const shouldDebug = true;
  const useNativeArtifacts = false;
  const skipMerkelTreeScans = false;
  const poiNodeURLs = remoteConfig.publicPoiAggregatorUrls ?? [];
  const customPOIList = undefined;

  await startRailgunEngine(
    "terminalwallet",
    engineDatabase,
    shouldDebug,
    artifactStorage,
    useNativeArtifacts,
    skipMerkelTreeScans,
    poiNodeURLs,
    customPOIList,
  );

  getProver().setSnarkJSGroth16(groth16 as Groth16);
  setLoggers(interceptLog.log, interceptLog.error);

  railgunEngineRunning = true;
};

const loadedRailgunNetworks: MapType<boolean> = {};
let currentLoadedNetwork: NetworkName;

export const getCurrentNetwork = () => {
  if (currentLoadedNetwork) {
    return currentLoadedNetwork;
  }
  throw new Error("No Network Loaded.");
};

export const rescanBalances = async (chainName: NetworkName) => {
  try {
    const chain = getChainForName(chainName);

    const walletIdFilter = walletManager.railgunWalletID;
    
    // Add timeout to prevent hanging (60 seconds)
    const scanPromise = scanUpdatesForMerkletreeAndWallets(chain, [walletIdFilter]);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Balance scan timed out after 60 seconds. RPC providers may be slow or unavailable.")), 60000);
    });
    
    await Promise.race([scanPromise, timeoutPromise]);
  } catch (err) {
    const errorMessage = (err as Error)?.message || String(err);
    if (errorMessage.includes("Failed to scan V2 events") || 
        errorMessage.includes("V2 events")) {
      throw new Error(
        `Failed to scan V2 events. This may be due to:\n` +
        `- RPC provider connectivity issues\n` +
        `- Network congestion\n` +
        `- Corrupted merkle tree data\n\n` +
        `Try using "Full TXID Rescan" from Wallet Tools menu to reset and rescan.`
      );
    }
    if (errorMessage.includes("timed out")) {
      throw new Error(
        `Balance scan timed out. This may be due to:\n` +
        `- Slow or unresponsive RPC providers\n` +
        `- Network connectivity issues\n` +
        `- High network congestion\n\n` +
        `Try refreshing balances again, or check your RPC provider settings.`
      );
    }
    throw err;
  }
};

export const isDefaultProvider = (chainName: NetworkName, rpcURL: string) => {
  const { providers } = configDefaults.networkConfig[chainName];

  const filteredDefaults = providers.filter(({ provider }) => {
    if (rpcURL === provider) {
      return true;
    }
    return false;
  });
  return filteredDefaults.length > 0;
};

export const getCustomProviderEnabledStatus = (
  chainName: NetworkName,
  rpcURL: string,
) => {
  const chainProviders = getCustomProvidersForChain(chainName);
  if (!isDefined(chainProviders)) {
    return true; // undefined?
  }

  const status = chainProviders[rpcURL];
  if (isDefined(status)) {
    return status;
  }
  return true;
};

export const getProviderPromptOptions = (chainName: NetworkName) => {
  const customProviders = getCustomProvidersForChain(chainName);

  const { providers } = configDefaults.networkConfig[chainName];
  if (isDefined(customProviders)) {
    const filteredDefaults = providers.filter(({ provider }) => {
      if (isDefined(customProviders[provider])) {
        return false;
      }
      return true;
    });

    const unsetDefaultPrompts = filteredDefaults.map(({ provider }) => {
      return {
        name: provider,
        message: `[${"Enabled ".green.dim}] ${provider}`,
      };
    });

    const customPrompts = Object.keys(customProviders).map((provider) => {
      const providerEnabled = customProviders[provider];
      return {
        name: provider,
        message: `[${providerEnabled ? "Enabled ".green.dim : "Disabled".yellow.dim
          }] ${provider}`,
      };
    });

    return [...unsetDefaultPrompts, ...customPrompts];
  } else {
    const defaultProviders = providers.map(({ provider }) => {
      return {
        name: provider,
        message: `[${"Enabled ".green.dim}] ${provider}`,
      };
    });
    return defaultProviders;
  }
};
export const loadProviderList = async (chainName: NetworkName) => {
  try {
    if (!isDefined(chainName)) {
      throw new Error("No chainName provided.");
    }
    
    if (!configDefaults.networkConfig[chainName]) {
      throw new Error(`Network configuration not found for ${chainName}`);
    }
    
    const customProviders = getCustomProvidersForChain(chainName);
    const { providers, chainId } = configDefaults.networkConfig[chainName];
    let combinedProviders = providers;
    if (isDefined(customProviders)) {
      const filteredDefaults = providers.filter(({ provider }) => {
        if (customProviders[provider] === false) {
          return false;
        }
        return true;
      });

      const refObjects = Object.keys(customProviders).map((key) => {
        if (customProviders[key]) {
          return getProviderObjectFromURL(key);
        }
        return undefined;
      });
      const customProviderJSONs = removeUndefineds(refObjects);

      combinedProviders = [...customProviderJSONs, ...filteredDefaults];
    }
    
    if (!combinedProviders || combinedProviders.length === 0) {
      throw new Error(`No RPC providers available for ${chainName}`);
    }
    
    // Add timeout for provider availability check (30 seconds)
    const providerCheckPromise = getAvailableProviderJSONs(
      chainId,
      [...combinedProviders],
      console.error,
    );
    const providerTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("RPC provider availability check timed out")), 30000);
    });
    
    const availableProviders = await Promise.race([
      providerCheckPromise,
      providerTimeoutPromise
    ]) as any[];
    
    if (!availableProviders || availableProviders.length === 0) {
      throw new Error(`No available RPC providers found for ${chainName}. Check your RPC configuration.`);
    }
    
    const newRPCJsonConfig: FallbackProviderJsonConfig = {
      chainId,
      providers: availableProviders,
    };
    const rpcPollingInterval = 20 * 1000;
    pauseAllPollingProviders(chainName);
    
    // Add timeout for provider loading (45 seconds)
    const loadProviderPromise = loadProvider(
      newRPCJsonConfig,
      chainName,
      rpcPollingInterval,
    );
    const loadTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("RPC provider loading timed out")), 45000);
    });
    
    const { feesSerialized } = await Promise.race([
      loadProviderPromise,
      loadTimeoutPromise
    ]) as any;
    
    if (!feesSerialized) {
      throw new Error(`Failed to load fees for ${chainName}`);
    }
    
    const feesShield = BigInt(
      feesSerialized.shieldFeeV3 ?? feesSerialized.shieldFeeV2 ?? 0n,
    );
    const feesUnshield = BigInt(
      feesSerialized.unshieldFeeV3 ?? feesSerialized.shieldFeeV2 ?? 0n,
    );

    setRailgunFees(chainName, feesShield, feesUnshield);
    loadedRailgunNetworks[chainName] = true;
    currentLoadedNetwork = chainName;
  } catch (error) {
    const errorMsg = (error as Error)?.message || String(error);
    throw new Error(`Failed to load provider list for ${chainName}: ${errorMsg}`);
  }
};

export const loadEngineProvidersForNetwork = async (chainName: NetworkName) => {
  try {
    if (chainName === currentLoadedNetwork && loadedRailgunNetworks[chainName]) {
      try {
        await rescanBalances(chainName);
      } catch (rescanError) {
        // Rescan errors are non-critical, log but continue
        console.error(`Warning: Balance rescan failed for ${chainName}:`, (rescanError as Error)?.message || String(rescanError));
      }
      return;
    }

    if (loadedRailgunNetworks[chainName]) {
      currentLoadedNetwork = chainName;
      resumeIsolatedPollingProviderForNetwork(chainName);
      try {
        await rescanBalances(chainName);
      } catch (rescanError) {
        // Rescan errors are non-critical, log but continue
        console.error(`Warning: Balance rescan failed for ${chainName}:`, (rescanError as Error)?.message || String(rescanError));
      }
      return;
    }

    await loadProviderList(chainName);
  } catch (error) {
    const errorMsg = (error as Error)?.message || String(error);
    throw new Error(`Failed to load engine providers for ${chainName}: ${errorMsg}`);
  }
};

export const pauseEngineProvidersExcept = (
  chainName: Optional<NetworkName>,
) => {
  pauseAllPollingProviders(chainName);
};

export const resumeEngineProvider = (chainName: NetworkName) => {
  resumeIsolatedPollingProviderForNetwork(chainName);
};

export const stopEngine = async () => {
  if (!isEngineRunning()) {
    return;
  }
  await stopRailgunEngine().catch((err) => {
    console.log(err);
    stopEngine();
  });
  return;
};
