import { NetworkName } from "@railgun-community/shared-models";
import { confirmPrompt, confirmPromptCatch } from "./confirm-ui";
import { tokenSelectionPrompt, transferTokenAmountSelectionPrompt } from "./token-ui";
import { getPrivateERC20BalancesForChain } from "../balance/balance-util";
import { getFormattedAddress } from "./address-ui";
import { getCurrentNetwork } from "../engine/engine";
import { buildEasePaymentCrossContractCall, verifyEasePayment, getEasePaymentReceipt } from "../transaction/cross-contract/ease-payment-tx";
import { getCrossContractCallGasEstimate, getProvedCrossContractCallTransaction } from "../transaction/cross-contract/cross-contract-tx";
import { getSaltedPassword } from "../wallet/wallet-password";
import { runTransactionBuilder } from "../transaction/transaction-builder";
import { RailgunTransaction } from "../models/transaction-models";
import { Contract } from "ethers";
import { getProviderForChain } from "../network/network-util";
import { EASE_PAYMENT_ROUTER_ABI } from "../abi/ease-payment-router-abi";
import { parseUnits } from "ethers";
import { colors, printSection, createBox } from "../util/style-util";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Input } = require("enquirer");

/**
 * Prompt for EASE payment contract address
 */
const promptContractAddress = async (): Promise<string | undefined> => {
  const prompt = new Input({
    name: "contractAddress",
    message: "Enter EASE Payment Router contract address:",
    validate: (value: string) => {
      if (!value || value.length === 0) {
        return "Contract address is required";
      }
      if (!value.startsWith("0x") || value.length !== 42) {
        return "Invalid Ethereum address format";
      }
      return true;
    },
  });

  const result = await prompt.run().catch(confirmPromptCatch);
  return result;
};

/**
 * Prompt for host ID
 */
const promptHostId = async (): Promise<string | undefined> => {
  const prompt = new Input({
    name: "hostId",
    message: "Enter Host ID:",
    validate: (value: string) => {
      if (!value || value.length === 0) {
        return "Host ID is required";
      }
      return true;
    },
  });

  const result = await prompt.run().catch(confirmPromptCatch);
  return result;
};

/**
 * Prompt for session hash
 */
const promptSessionHash = async (): Promise<string | undefined> => {
  const prompt = new Input({
    name: "sessionHash",
    message: "Enter Session Hash (bytes32, hex format):",
    validate: (value: string) => {
      if (!value || value.length === 0) {
        return "Session hash is required";
      }
      // Should be 66 chars (0x + 64 hex chars) for bytes32
      if (!value.startsWith("0x") || value.length !== 66) {
        return "Session hash must be bytes32 format (0x + 64 hex characters)";
      }
      return true;
    },
  });

  const result = await prompt.run().catch(confirmPromptCatch);
  return result;
};

/**
 * Prompt for payment token selection
 */
const promptPaymentToken = async (
  chainName: NetworkName,
): Promise<{ tokenAddress?: string; isBaseToken: boolean } | undefined> => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Select } = require("enquirer");

  const prompt = new Select({
    message: "Select payment token:",
    choices: [
      { name: "base", message: "Base Token (BNB/ETH)" },
      { name: "erc20", message: "ERC20 Token" },
      { name: "cancel", message: "Cancel".grey },
    ],
  });

  const selection = await prompt.run().catch(confirmPromptCatch);
  if (!selection || selection === "cancel") {
    return undefined;
  }

  if (selection === "base") {
    return { isBaseToken: true };
  }

  // For ERC20, use existing token selection
  const tokenSelection = await tokenSelectionPrompt(
    chainName,
    "Select token to pay with:",
    false, // single selection
    false, // private balances
  );
  if (!tokenSelection) {
    return undefined;
  }

  return {
    tokenAddress: tokenSelection.tokenAddress,
    isBaseToken: false,
  };
};

/**
 * Main EASE payment flow
 */
export const runEasePaymentPrompt = async (): Promise<void> => {
  const chainName = getCurrentNetwork();

  console.log("\n" + createBox(
    [
      colors.bold("EASE Payment Router - Private Payment"),
      "",
      "Pay for sessions privately using Railgun",
      "Your payment will be unshielded, sent to the contract, and any change shielded back",
    ],
    { title: "Private Payment", color: "primary", padding: 1 }
  ) + "\n");

  // Get contract address
  const contractAddress = await promptContractAddress();
  if (!contractAddress) {
    return;
  }

  // Verify contract exists (optional check)
  try {
    const provider = getProviderForChain(chainName);
    const contract = new Contract(contractAddress, EASE_PAYMENT_ROUTER_ABI, provider);
    await contract.factory(); // Try to call a view function to verify contract
    console.log(colors.success("✓ Contract verified"));
  } catch (error) {
    console.log(colors.warning("⚠ Could not verify contract. Continuing anyway..."));
  }

  // Get host ID
  const hostId = await promptHostId();
  if (!hostId) {
    return;
  }

  // Get session hash
  const sessionHash = await promptSessionHash();
  if (!sessionHash) {
    return;
  }

  // Select payment token
  const tokenSelection = await promptPaymentToken(chainName);
  if (!tokenSelection) {
    return;
  }

  // Get payment amount
  let amount: bigint;
  let selectedTokenAddress: string | undefined;
  
  if (tokenSelection.isBaseToken) {
    const amountPrompt = new Input({
      name: "amount",
      message: "Enter payment amount (in base token, e.g., 0.1 BNB):",
      validate: (value: string) => {
        if (!value || value.length === 0) {
          return "Amount is required";
        }
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          return "Amount must be a positive number";
        }
        return true;
      },
    });
    const amountStr = await amountPrompt.run().catch(confirmPromptCatch);
    if (!amountStr) {
      return;
    }
    // Convert to wei (18 decimals for base tokens)
    amount = parseUnits(amountStr, 18);
  } else {
    // Use transferTokenAmountSelectionPrompt for ERC20 tokens
    const result = await transferTokenAmountSelectionPrompt(
      chainName,
      false, // private balances
      false, // not public transfer
      true, // single selection
    );
    if (!result || !result.amountSelections || result.amountSelections.length === 0) {
      return;
    }
    const tokenAmount = result.amountSelections[0];
    amount = tokenAmount.amount;
    selectedTokenAddress = tokenAmount.tokenAddress;
  }

  // Build cross-contract call config
  console.log(colors.dim("\nBuilding payment transaction..."));
  const paymentConfig = await buildEasePaymentCrossContractCall({
    contractAddress,
    hostId,
    sessionHash,
    tokenAddress: tokenSelection.isBaseToken ? undefined : (selectedTokenAddress || tokenSelection.tokenAddress),
    amount,
    network: chainName,
  });

  // Display payment summary
  const summary = [
    colors.bold("Payment Summary:"),
    `Contract: ${getFormattedAddress(contractAddress)}`,
    `Host ID: ${hostId}`,
    `Session Hash: ${sessionHash}`,
    `Token: ${tokenSelection.isBaseToken ? "Base Token" : getFormattedAddress(selectedTokenAddress || tokenSelection.tokenAddress!)}`,
    `Amount: ${amount.toString()}`,
  ];

  printSection("Payment Details", summary, { color: "info" });

  const confirm = await confirmPrompt("Proceed with payment?", { initial: false });
  if (!confirm) {
    return;
  }

  // Get encryption key
  const encryptionKey = await getSaltedPassword();
  if (!encryptionKey) {
    console.log(colors.error("Failed to get encryption key"));
    return;
  }

  // Estimate gas
  console.log(colors.dim("\nEstimating gas..."));
  const gasEstimate = await getCrossContractCallGasEstimate(
    chainName,
    paymentConfig,
    encryptionKey,
  );

  if (!gasEstimate) {
    console.log(colors.error("Failed to estimate gas"));
    return;
  }

  console.log(
    colors.success(
      `✓ Gas estimate: ${gasEstimate.estimatedCost.toFixed(6)} ${gasEstimate.symbol}`,
    ),
  );

  // Generate proof and populate transaction
  console.log(colors.dim("\nGenerating proof (this may take 20-30 seconds)..."));
  const provedTransaction = await getProvedCrossContractCallTransaction(
    encryptionKey,
    paymentConfig,
    gasEstimate,
  );

  if (!provedTransaction) {
    console.log(colors.error("Failed to generate transaction"));
    return;
  }

  // Send transaction through the transaction builder
  // We'll need to integrate this with the existing transaction builder
  console.log(colors.success("✓ Transaction ready to send"));
  console.log(colors.dim("\nNote: Full integration with transaction builder pending"));
  console.log(colors.dim("Transaction data prepared. Ready for broadcast."));

  // TODO: Integrate with transaction builder to actually send the transaction
  // This would call runTransactionBuilder with the proved transaction
};

/**
 * Verify an EASE payment receipt
 */
export const runEasePaymentVerification = async (): Promise<void> => {
  const chainName = getCurrentNetwork();

  console.log("\n" + createBox(
    ["Verify EASE Payment Receipt"],
    { title: "Payment Verification", color: "info", padding: 1 }
  ) + "\n");

  const contractAddress = await promptContractAddress();
  if (!contractAddress) {
    return;
  }

  const receiptIdPrompt = new Input({
    name: "receiptId",
    message: "Enter Receipt ID (bytes32, hex format):",
    validate: (value: string) => {
      if (!value || value.length === 0) {
        return "Receipt ID is required";
      }
      if (!value.startsWith("0x") || value.length !== 66) {
        return "Receipt ID must be bytes32 format (0x + 64 hex characters)";
      }
      return true;
    },
  });

  const receiptId = await receiptIdPrompt.run().catch(confirmPromptCatch);
  if (!receiptId) {
    return;
  }

  const hostId = await promptHostId();
  if (!hostId) {
    return;
  }

  const minAmountPrompt = new Input({
    name: "minAmount",
    message: "Enter minimum amount to verify:",
    validate: (value: string) => {
      if (!value || value.length === 0) {
        return "Minimum amount is required";
      }
      const num = BigInt(value);
      if (num <= 0n) {
        return "Amount must be positive";
      }
      return true;
    },
  });

  const minAmountStr = await minAmountPrompt.run().catch(confirmPromptCatch);
  if (!minAmountStr) {
    return;
  }
  const minAmount = BigInt(minAmountStr);

  // Optional: session hash
  const useSessionHash = await confirmPrompt("Verify with session hash?", { initial: false });
  let sessionHash: string | undefined;
  if (useSessionHash) {
    sessionHash = await promptSessionHash();
  }

  console.log(colors.dim("\nVerifying payment..."));

  const isValid = await verifyEasePayment(
    contractAddress,
    receiptId,
    hostId,
    minAmount,
    chainName,
    sessionHash,
  );

  if (isValid) {
    console.log(colors.success("\n✓ Payment verified successfully!"));
  } else {
    console.log(colors.error("\n✗ Payment verification failed"));
  }

  // Get receipt details
  const receipt = await getEasePaymentReceipt(contractAddress, receiptId, chainName);
  if (receipt) {
    console.log("\n" + createBox(
      [
        `Host ID: ${receipt.hostId}`,
        `Token: ${getFormattedAddress(receipt.token)}`,
        `Amount: ${receipt.amount.toString()}`,
        `Session Hash: ${receipt.sessionHash}`,
        `Timestamp: ${new Date(Number(receipt.timestamp) * 1000).toLocaleString()}`,
        `Is Private: ${receipt.isPrivate ? "Yes" : "No"}`,
        `Payer: ${getFormattedAddress(receipt.payer)}`,
      ],
      { title: "Receipt Details", color: "info", padding: 1 }
    ));
  }
};

