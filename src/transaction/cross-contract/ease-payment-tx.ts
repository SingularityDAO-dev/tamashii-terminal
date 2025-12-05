import { Contract, ContractTransaction } from "ethers";
import {
  NetworkName,
  RailgunERC20Amount,
  RailgunERC20Recipient,
} from "@railgun-community/shared-models";
import { getProviderForChain } from "../../network/network-util";
import { getCurrentRailgunAddress } from "../../wallet/wallet-util";
import { CrossContractCall, CrossContractCallConfig } from "../../models/cross-contract-models";
import { EASE_PAYMENT_ROUTER_ABI } from "../../abi/ease-payment-router-abi";
import { formatUnits, parseUnits } from "ethers";
import { getTokenInfo } from "../../balance/token-util";

export type EasePaymentParams = {
  contractAddress: string;
  hostId: string;
  sessionHash: string;
  tokenAddress?: string; // If undefined, uses BNB/base token
  amount: bigint;
  network: NetworkName;
};

/**
 * Build cross-contract call configuration for EASE payment
 * This allows paying for sessions privately using Railgun
 */
export const buildEasePaymentCrossContractCall = async (
  params: EasePaymentParams,
): Promise<CrossContractCallConfig> => {
  const { contractAddress, hostId, sessionHash, tokenAddress, amount, network } = params;
  const provider = getProviderForChain(network);
  const railgunAddress = getCurrentRailgunAddress();

  // Create contract instance
  const paymentContract = new Contract(
    contractAddress,
    EASE_PAYMENT_ROUTER_ABI,
    provider,
  );

  // Build the contract call
  let crossContractCall: ContractTransaction;
  
  if (tokenAddress) {
    // ERC20 token payment
    crossContractCall = await paymentContract.payForSession.populateTransaction(
      hostId,
      tokenAddress,
      amount,
      sessionHash,
    );
  } else {
    // BNB/base token payment
    crossContractCall = await paymentContract.payForSessionBNB.populateTransaction(
      hostId,
      sessionHash,
    );
    crossContractCall.value = amount; // Include ETH/BNB value
  }

  // Convert to CrossContractCall format
  const contractCall: CrossContractCall = {
    to: contractAddress,
    data: crossContractCall.data || "0x",
    value: crossContractCall.value || 0n,
  };

  // Determine tokens to unshield
  const relayAdaptUnshieldERC20Amounts: RailgunERC20Amount[] = [];
  
  if (tokenAddress) {
    // Get token info for proper formatting
    const tokenInfo = await getTokenInfo(network, tokenAddress);
    
    relayAdaptUnshieldERC20Amounts.push({
      tokenAddress,
      amount,
    });
  } else {
    // For base token, we need to unshield wrapped token (WETH, WBNB, etc.)
    // This depends on the network - you may need to adjust this
    const { wrappedAddress } = require("@railgun-community/shared-models").NETWORK_CONFIG[network].baseToken;
    
    relayAdaptUnshieldERC20Amounts.push({
      tokenAddress: wrappedAddress,
      amount,
    });
  }

  // Determine tokens to shield back (usually none for payments, but include the token in case of refunds/dust)
  const relayAdaptShieldERC20Addresses: RailgunERC20Recipient[] = [];
  
  if (tokenAddress) {
    // Shield back the same token (in case of refunds or dust)
    relayAdaptShieldERC20Addresses.push({
      tokenAddress,
      recipientAddress: railgunAddress,
    });
  } else {
    // Shield back wrapped base token
    const { wrappedAddress } = require("@railgun-community/shared-models").NETWORK_CONFIG[network].baseToken;
    relayAdaptShieldERC20Addresses.push({
      tokenAddress: wrappedAddress,
      recipientAddress: railgunAddress,
    });
  }

  // Estimate minimum gas limit (adjust based on contract complexity)
  const minGasLimit = 500_000n; // Conservative estimate for payment transactions

  return {
    relayAdaptUnshieldERC20Amounts,
    crossContractCalls: [contractCall],
    relayAdaptShieldERC20Addresses,
    minGasLimit,
    network,
    description: `EASE Payment: ${hostId} - Session: ${sessionHash}`,
  };
};

/**
 * Verify a payment receipt (read-only, no transaction needed)
 */
export const verifyEasePayment = async (
  contractAddress: string,
  receiptId: string,
  hostId: string,
  minAmount: bigint,
  network: NetworkName,
  sessionHash?: string,
): Promise<boolean> => {
  const provider = getProviderForChain(network);
  const paymentContract = new Contract(
    contractAddress,
    EASE_PAYMENT_ROUTER_ABI,
    provider,
  );

  try {
    if (sessionHash) {
      return await paymentContract.verifyPaymentWithSession(
        receiptId,
        hostId,
        sessionHash,
        minAmount,
      );
    } else {
      return await paymentContract.verifyPayment(receiptId, hostId, minAmount);
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    return false;
  }
};

/**
 * Get payment receipt details (read-only)
 */
export const getEasePaymentReceipt = async (
  contractAddress: string,
  receiptId: string,
  network: NetworkName,
) => {
  const provider = getProviderForChain(network);
  const paymentContract = new Contract(
    contractAddress,
    EASE_PAYMENT_ROUTER_ABI,
    provider,
  );

  try {
    const receipt = await paymentContract.getReceipt(receiptId);
    return {
      hostId: receipt.hostId,
      token: receipt.token,
      amount: receipt.amount,
      sessionHash: receipt.sessionHash,
      timestamp: receipt.timestamp,
      isPrivate: receipt.isPrivate,
      payer: receipt.payer,
    };
  } catch (error) {
    console.error("Error getting receipt:", error);
    return null;
  }
};

