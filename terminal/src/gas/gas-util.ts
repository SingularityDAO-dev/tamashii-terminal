import {
  EVMGasType,
  NETWORK_CONFIG,
  NetworkName,
  TransactionGasDetails,
  TransactionGasDetailsType1,
  TransactionGasDetailsType2,
  isDefined,
} from "@railgun-community/shared-models";
import { ContractTransaction } from "ethers";
import { throwError } from "../util/util";
import { getGasEstimateMatrix, getGasEstimates } from "./gas-fee";
import { getProviderForChain, getFirstPollingProviderForChain } from "../network/network-util";

export const calculatePublicGasFee = async (
  transaction: ContractTransaction,
) => {
  const { gasPrice, maxFeePerGas, gasLimit } = transaction;

  if (typeof gasLimit !== "undefined") {
    if (typeof gasPrice !== "undefined") {
      return gasPrice * gasLimit;
    }
    if (typeof maxFeePerGas !== "undefined") {
      return maxFeePerGas * gasLimit;
    }
  }
  throw new Error("No Gas present Details in Transaction");
};

export const calculateEstimatedGasCost = (
  estimatedDetails: TransactionGasDetails,
) => {
  const { gasEstimate } = estimatedDetails;

  if (typeof estimatedDetails.gasEstimate !== "undefined") {
    if (
      typeof (estimatedDetails as TransactionGasDetailsType1).gasPrice !==
      "undefined"
    ) {
      return (
        (estimatedDetails as TransactionGasDetailsType1).gasPrice * gasEstimate
      );
    }
    if (
      typeof (estimatedDetails as TransactionGasDetailsType2).maxFeePerGas !==
      "undefined"
    ) {
      return (
        (estimatedDetails as TransactionGasDetailsType2).maxFeePerGas *
        gasEstimate
      );
    }
  }
  throw new Error("No Gas present Details in Transaction");
};

export const getPublicGasEstimate = async (
  chainName: NetworkName,
  transaction: ContractTransaction,
) => {
  try {
    const provider = getProviderForChain(chainName);
    const gasEstimate = await provider
      .estimateGas(transaction)
      .catch(throwError);
    return gasEstimate;
  } catch (error) {
    console.log(error);
    throw new Error("Gas Estimation Error");
  }
};

export const getFeeDetailsForChain = async (chainName: NetworkName) => {
  try {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (chainName) {
      case NetworkName.Ethereum:
      case NetworkName.Polygon: {
        try {
          const currentGasEstimate = await getGasEstimates(chainName);
          const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } =
            currentGasEstimate;

          return {
            gasPrice,
            maxFeePerGas,
            maxPriorityFeePerGas,
          };
        } catch (err) {
          // Fallback to provider.getFeeData() if getGasEstimates fails
          console.error(`Warning: Failed to get gas estimates for ${chainName}, trying fallback...`);
        }
        break;
      }
    }
    
    // For BNB Chain and other networks, try provider.getFeeData()
    const provider = getProviderForChain(chainName);
    
    // Add timeout for getFeeData
    const feeDataPromise = provider.getFeeData();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("getFeeData timed out")), 15000);
    });
    
    let feeData = await Promise.race([feeDataPromise, timeoutPromise]).catch((err) => {
      const errorMessage = (err as Error)?.message || String(err);
      // If quorum not met, fall back to single provider
      if (errorMessage.includes("quorum not met")) {
        console.error(`Warning: getFeeData quorum not met for ${chainName}, trying single provider...`);
        return undefined; // Will trigger single provider fallback
      }
      console.error(`Warning: getFeeData failed for ${chainName}:`, errorMessage);
      return undefined;
    }) as { gasPrice?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } | undefined;
    
    // If FallbackProvider failed (quorum not met), try single provider
    if (!isDefined(feeData) || (!feeData.gasPrice && !feeData.maxFeePerGas)) {
      try {
        const singleProvider = getFirstPollingProviderForChain(chainName);
        const singleFeeDataPromise = singleProvider.getFeeData();
        const singleTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("getFeeData timed out")), 15000);
        });
        
        feeData = await Promise.race([singleFeeDataPromise, singleTimeoutPromise]).catch((err) => {
          console.error(`Warning: Single provider getFeeData failed for ${chainName}:`, (err as Error)?.message || String(err));
          return undefined;
        }) as { gasPrice?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } | undefined;
      } catch (singleProviderErr) {
        console.error(`Warning: Failed to get single provider for ${chainName}`);
      }
    }
    
    if (isDefined(feeData) && (feeData.gasPrice || feeData.maxFeePerGas)) {
      return feeData;
    }
    
    // Final fallback: try to get basic gas price using polling provider
    try {
      const pollingProvider = getFirstPollingProviderForChain(chainName);
      const gasPriceHex = await Promise.race([
        pollingProvider.send("eth_gasPrice", []),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("eth_gasPrice timed out")), 10000))
      ]).catch(() => undefined) as string | undefined;
      
      if (gasPriceHex) {
        const gasPrice = BigInt(gasPriceHex);
        // For BNB Chain, use Type0/Type1 gas (gasPrice)
        return {
          gasPrice,
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: 0n,
        };
      }
    } catch (fallbackErr) {
      console.error(`Warning: Gas price fallback also failed for ${chainName}`);
    }
    
    throw new Error(
      `Unable to get Gas Fee Data for ${chainName}. ` +
      `This may be due to:\n` +
      `- RPC provider connectivity issues\n` +
      `- Network congestion\n` +
      `- RPC provider not supporting required methods\n\n` +
      `Try checking your RPC provider settings or switching to a different provider.`
    );
  } catch (err) {
    const errorMessage = (err as Error)?.message || String(err);
    if (errorMessage.includes("Unable to get Gas Fee Data")) {
      throw err; // Re-throw our formatted error
    }
    throw new Error(`Failed to get gas fee data for ${chainName}: ${errorMessage}`);
  }
};

export const getPublicGasDetails = async (
  chainName: NetworkName,
  gasEstimate: bigint,
  isShield = false,
) => {
  const feeData = await getFeeDetailsForChain(chainName);
  const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } = feeData;
  let gasDetailsInfo: {
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
  } = { gasPrice: gasPrice ?? 0n };

  const { defaultEVMGasType } = NETWORK_CONFIG[chainName];

  // SELECTED DEFAULT because these are transacted through a personal wallet.
  switch (defaultEVMGasType) {
    case EVMGasType.Type0:
    case EVMGasType.Type1: {
      gasDetailsInfo.gasPrice = gasPrice ?? 0n;
      break;
    }
    case EVMGasType.Type2: {
      gasDetailsInfo = {
        maxFeePerGas: maxFeePerGas ?? gasPrice ?? 0n,
        maxPriorityFeePerGas: maxPriorityFeePerGas ?? 0n,
      };
      break;
    }
  }

  if (isShield) {
    const gasDetails = {
      evmGasType: defaultEVMGasType,
      gasEstimate,
      ...gasDetailsInfo,
    } as TransactionGasDetails;

    return gasDetails;
  }
  const gasDetails = {
    gasLimit: gasEstimate,
    ...gasDetailsInfo,
  };
  return gasDetails;
};
