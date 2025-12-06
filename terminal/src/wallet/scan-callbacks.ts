import {
  MerkletreeScanUpdateEvent,
  POIProofEventStatus,
  POIProofProgressEvent,
  RailgunBalancesEvent,
  delay,
  isDefined,
} from "@railgun-community/shared-models";
import { type BatchListUpdateEvent} from "@railgun-community/wallet"
import {
  updatePrivateBalancesForChain,
  updatePublicBalancesForChain,
} from "../balance/balance-cache";
import { ChainIDToNameMap } from "../models/network-models";
import { getCurrentNetwork, rescanBalances } from "../engine/engine";
import { walletManager } from "./wallet-manager";
import { setStatusText } from "../ui/status-ui";

// V2 scan errors are silently suppressed - no tracking needed

export const merkelTreeScanCallback = async (
  callbackInfo: MerkletreeScanUpdateEvent,
) => {
  try {
    walletManager.balanceScanProgress = callbackInfo.progress * 100;

    if (callbackInfo.scanStatus === "Complete") {
      walletManager.merkelScanComplete = true;
    }
    if (callbackInfo.scanStatus === "Incomplete") {
      rescanBalances(getCurrentNetwork()).catch((err) => {
        const errorMessage = err?.message || String(err);
        
        // Silently suppress V2 scan errors - no user notification
        if (errorMessage.includes("Failed to scan V2 events") || 
            errorMessage.includes("V2 events")) {
          // Completely suppress - no status messages or logs
          return;
        }
        // Other scan errors can be logged if needed, but V2 errors are suppressed
      });
    }
  } catch (err) {
    const errorMessage = (err as Error)?.message || String(err);
    
    // Silently suppress V2 scan errors
    if (errorMessage.includes("Failed to scan V2 events") || 
        errorMessage.includes("V2 events")) {
      // Completely suppress - no status messages or logs
      return;
    }
    // Other errors are handled silently as well
  }
};

export const formatLatestBalancesEvent = async () => {
  try {
    const currentPrivateBalances = walletManager.latestPrivateBalanceEvents;
    if (!isDefined(currentPrivateBalances)) {
      walletManager.latestPrivateBalanceEvents = [];
      return;
    }
    if (!isDefined(walletManager.latestPrivateBalanceEvents)) {
      return;
    }

    // sort into each balance bucket, only take the latest one.
    const buckets: MapType<RailgunBalancesEvent> = {};
    for (const balanceEvent of walletManager.latestPrivateBalanceEvents) {
      buckets[balanceEvent.balanceBucket] = balanceEvent;
    }

    for (const bucketType in buckets) {
      if (walletManager.merkelScanComplete) {
        const balanceEvent = buckets[bucketType];
        const { chain } = balanceEvent;
        const chainName = ChainIDToNameMap[chain.id];
        await updatePrivateBalancesForChain(chainName, balanceEvent);
        await updatePublicBalancesForChain(chainName);
        if (!walletManager.menuLoaded) {
          walletManager.menuLoaded = true;
        }
      }
    }

    delete walletManager.latestPrivateBalanceEvents;
    walletManager.latestPrivateBalanceEvents = [];
  } catch (err) {
    const errorMessage = (err as Error)?.message || String(err);
    
    // Silently suppress V2 scan errors in balance updates
    if (errorMessage.includes("Failed to scan V2 events") || 
        errorMessage.includes("V2 events")) {
      // Completely suppress - no status messages or logs
      return;
    }
    // Don't throw - allow polling to continue
  }
};

export const scanBalancesCallback = async (
  tokenBalances: RailgunBalancesEvent,
) => {
  walletManager.latestPrivateBalanceEvents?.push(tokenBalances);
};

export const latestBalancePoller = async (pollingInterval: number) => {
  await formatLatestBalancesEvent().catch((err) => {
    setStatusText(err.message);
  });
  await delay(pollingInterval);
  latestBalancePoller(pollingInterval);
};

export const getPOIStatusString = () => {
  const event = walletManager.poiProgressEvent;
  const status = `POI Status: ${event.status} | TX: ${event.index}/${event.totalCount
    } | Progress: ${event.progress.toFixed(2)}\nTxID: ${event.txid
    }\nPOI List ID: ${event.listKey}`;

  return status;
};

export const poiScanCallback = async (poiProgressEvent: POIProofProgressEvent) => {
  walletManager.poiProgressEvent = poiProgressEvent;

  if (poiProgressEvent.status === POIProofEventStatus.InProgress) {
    const poiStatus = getPOIStatusString();
    setStatusText(poiStatus, 15000, true);
  }
};

export const batchListCallback = async (batchListProgressEvent: BatchListUpdateEvent) =>{
  try {
    const status = `${batchListProgressEvent.status}`
    if(status.includes('100%')){
      setStatusText(status, 15000, false);
    } else {
      setStatusText(status, 15000, false);
    }
  } catch (err) {
    const errorMessage = (err as Error)?.message || String(err);
    // Silently suppress V2 scan errors
    if (errorMessage.includes("Failed to scan V2 events") || 
        errorMessage.includes("V2 events")) {
      // Completely suppress - no status messages or logs
      return;
    }
    // Other errors are also suppressed to keep the UI clean
  }
}
