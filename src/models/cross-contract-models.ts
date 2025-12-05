import { ContractTransaction } from "ethers";
import {
  RailgunERC20Amount,
  RailgunERC20Recipient,
  NetworkName,
} from "@railgun-community/shared-models";

/**
 * Cross-contract call configuration
 * Based on Railgun's cross-contract call structure
 * See: https://docs.railgun.org/developer-guide/wallet/transactions/cross-contract-calls
 */
export type CrossContractCall = {
  to: string; // Contract address
  data: string; // Function call data (hex encoded)
  value: bigint; // ETH/BNB value to send (0 for most calls)
};

export type CrossContractCallConfig = {
  // Tokens to unshield from private balance (exact amounts needed)
  relayAdaptUnshieldERC20Amounts: RailgunERC20Amount[];
  
  // Contract calls to execute (ordered sequence)
  crossContractCalls: CrossContractCall[];
  
  // Token addresses to shield back into private balance after calls
  relayAdaptShieldERC20Addresses: RailgunERC20Recipient[];
  
  // Minimum gas limit for the transaction
  minGasLimit: bigint;
  
  // Network for the transaction
  network: NetworkName;
  
  // Optional: Description of what this call does
  description?: string;
};

