import {
  NetworkName,
  TXIDVersion,
  RailgunERC20Amount,
  RailgunERC20Recipient,
  RailgunPopulateTransactionResponse,
  SelectedBroadcaster,
  isDefined,
} from "@railgun-community/shared-models";
import {
  gasEstimateForUnprovenCrossContractCalls,
  generateCrossContractCallsProof,
  populateProvedCrossContractCalls,
} from "@railgun-community/wallet";
import { ContractTransaction } from "ethers";
import {
  getCurrentRailgunID,
} from "../../wallet/wallet-util";
import { getTransactionGasDetails } from "../private/private-tx";
import { getOutputGasEstimate } from "../private/unshield-tx";
import {
  PrivateGasDetails,
  PrivateGasEstimate,
} from "../../models/transaction-models";
import { ProgressBar } from "../../ui/progressBar-ui";
import { CrossContractCall, CrossContractCallConfig } from "../../models/cross-contract-models";

/**
 * Convert CrossContractCall to ContractTransaction format
 */
const convertToContractTransaction = (
  call: CrossContractCall,
): ContractTransaction => {
  return {
    to: call.to,
    data: call.data,
    value: call.value,
  } as ContractTransaction;
};

/**
 * Get gas estimate for cross-contract calls
 */
export const getCrossContractCallGasEstimate = async (
  chainName: NetworkName,
  config: CrossContractCallConfig,
  encryptionKey: string,
  broadcasterSelection?: SelectedBroadcaster,
): Promise<PrivateGasEstimate | undefined> => {
  const railgunWalletID = getCurrentRailgunID();
  const txIDVersion = TXIDVersion.V2_PoseidonMerkle;

  const gasDetailsResult = await getTransactionGasDetails(
    chainName,
    broadcasterSelection,
  );

  if (!gasDetailsResult) {
    console.log("Failed to get Gas Details for Transaction");
    return undefined;
  }

  const {
    originalGasDetails,
    feeTokenDetails,
    feeTokenInfo,
    sendWithPublicWallet,
    overallBatchMinGasPrice,
  } = gasDetailsResult as PrivateGasDetails;

  const crossContractCalls: ContractTransaction[] = config.crossContractCalls.map(
    convertToContractTransaction,
  );

  const { gasEstimate } = await gasEstimateForUnprovenCrossContractCalls(
    txIDVersion,
    chainName,
    railgunWalletID,
    encryptionKey,
    config.relayAdaptUnshieldERC20Amounts,
    [], // No NFT unshields for now
    config.relayAdaptShieldERC20Addresses,
    [], // No NFT shields for now
    crossContractCalls,
    originalGasDetails,
    feeTokenDetails,
    sendWithPublicWallet,
    config.minGasLimit,
  );

  return await getOutputGasEstimate(
    originalGasDetails,
    gasEstimate,
    feeTokenInfo,
    feeTokenDetails,
    broadcasterSelection,
    overallBatchMinGasPrice,
  );
};

/**
 * Generate proof and populate transaction for cross-contract calls
 */
export const getProvedCrossContractCallTransaction = async (
  encryptionKey: string,
  config: CrossContractCallConfig,
  privateGasEstimate: PrivateGasEstimate,
): Promise<Optional<RailgunPopulateTransactionResponse>> => {
  const chainName = config.network;
  const railgunWalletID = getCurrentRailgunID();
  const txIDVersion = TXIDVersion.V2_PoseidonMerkle;

  const progressBar = new ProgressBar("Starting Proof Generation");
  const progressCallback = (progress: number, progressStats?: string) => {
    if (isDefined(progressStats)) {
      progressBar.updateProgress(
        `Cross-Contract Call Proof Generation | [${progressStats}]`,
        progress,
      );
    } else {
      progressBar.updateProgress(`Cross-Contract Call Proof Generation`, progress);
    }
  };

  const crossContractCalls: ContractTransaction[] = config.crossContractCalls.map(
    convertToContractTransaction,
  );

  const {
    broadcasterFeeERC20Recipient,
    overallBatchMinGasPrice,
    estimatedGasDetails,
  } = privateGasEstimate as PrivateGasEstimate;
  const sendWithPublicWallet =
    typeof broadcasterFeeERC20Recipient !== "undefined" ? false : true;

  try {
    await generateCrossContractCallsProof(
      txIDVersion,
      chainName,
      railgunWalletID,
      encryptionKey,
      config.relayAdaptUnshieldERC20Amounts,
      [], // No NFT unshields
      config.relayAdaptShieldERC20Addresses,
      [], // No NFT shields
      crossContractCalls,
      broadcasterFeeERC20Recipient,
      sendWithPublicWallet,
      overallBatchMinGasPrice,
      config.minGasLimit,
      progressCallback,
    )
      .catch((err) => {
        console.log("Error generating cross-contract call proof:", err);
        throw err;
      })
      .finally(() => {
        progressBar.complete();
      });

    const { transaction, nullifiers, preTransactionPOIsPerTxidLeafPerList } =
      await populateProvedCrossContractCalls(
        txIDVersion,
        chainName,
        railgunWalletID,
        config.relayAdaptUnshieldERC20Amounts,
        [],
        config.relayAdaptShieldERC20Addresses,
        [],
        crossContractCalls,
        broadcasterFeeERC20Recipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
        estimatedGasDetails,
      );

    return { transaction, nullifiers, preTransactionPOIsPerTxidLeafPerList };
  } catch (err) {
    const error = err as Error;
    console.log("ERROR getting proved cross-contract call transaction.", error.message, error.cause);
    throw error;
  }
};

