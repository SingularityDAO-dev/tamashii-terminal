import {
  NetworkName,
  RailgunERC20Amount,
  RailgunERC20AmountRecipient,
  RailgunPopulateTransactionResponse,
  SelectedBroadcaster,
  TXIDVersion,
  isDefined,
} from "@railgun-community/shared-models";
import {
  calculateBroadcasterFeeERC20Amount,
  gasEstimateForUnprovenUnshieldBaseToken,
  generateUnshieldBaseTokenProof,
  populateProvedUnshieldBaseToken,
} from "@railgun-community/wallet";
import { formatUnits } from "ethers";
import { ProgressBar } from "../../ui/progressBar-ui";
import {
  calculateSelfSignedGasEstimate,
  getTransactionGasDetails,
} from "../private/private-tx";
import { PrivateGasEstimate } from "../../models/transaction-models";
import { getCurrentRailgunID } from "../../wallet/wallet-util";
import { getCurrentNetwork } from "../../engine/engine";

export const getUnshieldBaseTokenGasEstimate = async (
  chainName: NetworkName,
  _wrappedERC20Amount: RailgunERC20AmountRecipient,
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
    overallBatchMinGasPrice,
    feeTokenDetails,
    feeTokenInfo,
    sendWithPublicWallet,
  } = gasDetailsResult;
  const wrappedERC20Amount: RailgunERC20Amount = {
    tokenAddress: _wrappedERC20Amount.tokenAddress, // wETH
    amount: _wrappedERC20Amount.amount, // hexadecimal amount
  };
  console.log(
    "Getting Gas Estimate for Transaction...... this may take some time",
  );
  
  let gasEstimate: bigint;
  let broadcasterFeeCommitment: any;
  
  try {
    const result = await gasEstimateForUnprovenUnshieldBaseToken(
      txIDVersion,
      chainName,
      _wrappedERC20Amount.recipientAddress,
      railgunWalletID,
      encryptionKey,
      wrappedERC20Amount,
      originalGasDetails,
      feeTokenDetails,
      sendWithPublicWallet,
    );
    gasEstimate = result.gasEstimate;
    broadcasterFeeCommitment = result.broadcasterFeeCommitment;
  } catch (err) {
    const errorMsg = (err as Error)?.message || String(err);
    
    if (errorMsg.includes("Unable to decrypt ciphertext") || 
        errorMsg.includes("decrypt")) {
      console.error("\n" + "=".repeat(60).yellow);
      console.error("⚠️  Decryption Error".yellow.bold);
      console.error("=".repeat(60).yellow);
      console.error("Unable to decrypt wallet data. This can happen if:".yellow);
      console.error("1. Your password is incorrect".yellow);
      console.error("2. The wallet balance scan is still in progress".yellow);
      console.error("3. The cached wallet data needs to be refreshed".yellow);
      console.error("\nTry:".yellow);
      console.error("- Wait for the balance scan to complete (check the progress bar)".yellow);
      console.error("- Go back to the main menu and select 'View Balance' to refresh".yellow);
      console.error("- Re-enter your password when prompted".yellow);
      console.error("=".repeat(60).yellow + "\n");
    }
    
    throw err;
  }

  const estimatedGasDetails = { ...originalGasDetails, gasEstimate };
  const { symbol } = feeTokenInfo;
  let broadcasterFeeERC20Recipient;
  let estimatedCost = 0;
  if (feeTokenDetails && broadcasterSelection) {
    console.log("Calculating Gas Fee...... this may take some time");
    const broadcasterFeeAmountDetails =
      await calculateBroadcasterFeeERC20Amount(
        feeTokenDetails,
        estimatedGasDetails,
      );

    estimatedCost = parseFloat(
      formatUnits(broadcasterFeeAmountDetails.amount, feeTokenInfo.decimals),
    );

    // if self relayed, this will be returned undefined.
    broadcasterFeeERC20Recipient = {
      tokenAddress: broadcasterFeeAmountDetails.tokenAddress,
      amount: broadcasterFeeAmountDetails.amount,
      recipientAddress: broadcasterSelection.railgunAddress,
    } as RailgunERC20AmountRecipient;
  } else {
    const selfSignedCost = calculateSelfSignedGasEstimate(estimatedGasDetails);
    estimatedCost = parseFloat(
      formatUnits(selfSignedCost, feeTokenInfo.decimals),
    );
  }

  return {
    symbol,
    estimatedGasDetails,
    estimatedCost,
    broadcasterFeeERC20Recipient,
    overallBatchMinGasPrice,
  };
};

export const getProvedUnshieldBaseTokenTransaction = async (
  encryptionKey: string,
  erc20AmountRecipient: RailgunERC20AmountRecipient,
  privateGasEstimate: PrivateGasEstimate,
): Promise<Optional<RailgunPopulateTransactionResponse>> => {
  const chainName = getCurrentNetwork();
  const railgunWalletID = getCurrentRailgunID();
  const txIDVersion = TXIDVersion.V2_PoseidonMerkle;
  
  // Validate amount
  if (!erc20AmountRecipient.amount || erc20AmountRecipient.amount === 0n) {
    throw new Error("Unshield value must be greater than 0. Please check your amount selection.");
  }

  let progressBar = new ProgressBar("Starting Proof Generation");
  const progressCallback = (progress: number, progressStats: string) => {
    if (isDefined(progressStats)) {
      progressBar.updateProgress(
        `Transaction Proof Generation | [${progressStats}]`,
        progress,
      );
    } else {
      progressBar.updateProgress(`Transaction Proof Generation`, progress);
    }
  };

  const {
    broadcasterFeeERC20Recipient,
    overallBatchMinGasPrice,
    estimatedGasDetails,
  } = privateGasEstimate;

  const sendWithPublicWallet =
    typeof broadcasterFeeERC20Recipient !== "undefined" ? false : true;
  try {
    const wrappedERC20Amount: RailgunERC20Amount = {
      tokenAddress: erc20AmountRecipient.tokenAddress, // wETH
      amount: erc20AmountRecipient.amount, // hexadecimal amount
    };

    // Workaround for Railgun library issue: "Cannot cache a transaction with a from address"
    // This error occurs inside the library during proof generation
    // We'll try up to 3 times with a delay between attempts
    let lastError: Error | undefined;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await generateUnshieldBaseTokenProof(
          txIDVersion,
          chainName,
          erc20AmountRecipient.recipientAddress,
          railgunWalletID,
          encryptionKey,
          wrappedERC20Amount,
          broadcasterFeeERC20Recipient,
          sendWithPublicWallet,
          overallBatchMinGasPrice,
          progressCallback,
        ).finally(() => {
          progressBar.complete();
        });
        
        // Success - break out of retry loop
        lastError = undefined;
        break;
      } catch (proofError: any) {
        const errorMsg = (proofError as Error)?.message || String(proofError);
        lastError = proofError as Error;
        
        if (errorMsg.includes("Cannot cache a transaction with a from address")) {
          if (attempt < maxRetries) {
            // Retry with a delay
            const delayMs = attempt * 2000; // 2s, 4s, 6s delays
            console.warn(`\n⚠️  Proof generation error (attempt ${attempt}/${maxRetries}). Retrying in ${delayMs/1000}s...\n`.yellow);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            // Create a new progress bar for retry
            progressBar.complete();
            progressBar = new ProgressBar(`Retrying Proof Generation (attempt ${attempt + 1}/${maxRetries})`);
            continue; // Try again
          } else {
            // All retries failed - this is a known library bug with self-signing
            console.error("\n" + "=".repeat(60).yellow);
            console.error("⚠️  Known Railgun Library Issue".yellow.bold);
            console.error("=".repeat(60).yellow);
            console.error("The Railgun library has a bug when generating proofs for self-signed transactions.".yellow);
            console.error("Tried 3 times but the error persists.".yellow);
            console.error("\n⚠️  IMPORTANT: Workaround Available".yellow.bold);
            console.error("=".repeat(60).yellow);
            console.error("You can use a broadcaster for proof generation (even if it's out of gas for sending).".yellow);
            console.error("Proof generation doesn't require the broadcaster to have gas.".yellow);
            console.error("\nSteps to work around:".yellow);
            console.error("1. Go back and select 'broadcaster' when prompted for transaction fee options".yellow);
            console.error("2. Select any available broadcaster (even if it shows 'out of gas')".yellow);
            console.error("3. The proof will generate successfully".yellow);
            console.error("4. When sending, you can still choose self-signing if the broadcaster is out of gas".yellow);
            console.error("\nAlternative:".yellow);
            console.error("- Wait a few minutes and try the broadcaster again (it may refill gas)".yellow);
            console.error("- Check if there's a newer version of @railgun-community/wallet".yellow);
            console.error("=".repeat(60).yellow + "\n");
            
            throw new Error(
              `Railgun library error: Cannot cache transaction with 'from' address.\n\n` +
              `This is a known bug in @railgun-community/wallet v10.4.1 when using self-signing.\n` +
              `Tried ${maxRetries} times but the error persists.\n\n` +
              `WORKAROUND: Use a broadcaster for proof generation:\n` +
              `1. Go back and select 'broadcaster' when prompted for fee options\n` +
              `2. Select any broadcaster (even if it shows 'out of gas')\n` +
              `3. Proof generation will work (it doesn't need broadcaster gas)\n` +
              `4. You can still self-sign when sending if broadcaster is out of gas\n\n` +
              `Original error: ${errorMsg}`
            );
          }
        } else {
          // Different error - don't retry
          throw proofError;
        }
      }
    }
    
    // If we exhausted retries and still have an error, throw it
    if (lastError) {
      throw lastError;
    }

    const { transaction, nullifiers, preTransactionPOIsPerTxidLeafPerList } =
      await populateProvedUnshieldBaseToken(
        txIDVersion,
        chainName,
        erc20AmountRecipient.recipientAddress,
        railgunWalletID,
        erc20AmountRecipient,
        broadcasterFeeERC20Recipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
        estimatedGasDetails,
      );

    // Remove 'from' field immediately to prevent ethers.js caching issues
    // Create a new transaction object without 'from' field
    const { from, ...cleanedTransaction } = transaction;
    const finalTransaction = { ...cleanedTransaction };

    return { transaction: finalTransaction, nullifiers, preTransactionPOIsPerTxidLeafPerList };
  } catch (err) {
    const error = err as Error;
    const errorMsg = error.message || String(err);
    
    // Handle "Private balance too low to pay broadcaster fee" specifically
    if (errorMsg.includes("Private balance too low") || errorMsg.includes("balance too low")) {
      console.error("\n" + "=".repeat(60).yellow);
      console.error("⚠️  Insufficient Shielded Balance".yellow.bold);
      console.error("=".repeat(60).yellow);
      
      // Display fee information if available
      if (broadcasterFeeERC20Recipient) {
        const feeAmount = formatUnits(broadcasterFeeERC20Recipient.amount, 18);
        const unshieldAmount = formatUnits(erc20AmountRecipient.amount, 18);
        const totalRequired = parseFloat(feeAmount) + parseFloat(unshieldAmount);
        
        console.error("\n📊 Transaction Breakdown:".cyan.bold);
        console.error(`   Unshield Amount:    ${unshieldAmount} WBNB`.white);
        console.error(`   Broadcaster Fee:    ${feeAmount} WBNB`.white);
        console.error(`   ─────────────────────────────────`.dim);
        console.error(`   Total Required:     ${totalRequired.toFixed(8)} WBNB`.cyan.bold);
        
        console.error("\n💡 Solutions:".green.bold);
        console.error("   1. Reduce your unshield amount to leave room for the fee".white);
        console.error("   2. Shield more BNB to increase your private balance".white);
        console.error("   3. Use Self-Sign (no broadcaster fee needed)".white);
        console.error("      → When prompted for 'Transaction Fee Options', select 'Self Sign Transaction'".dim);
        console.error("      → Your public wallet pays gas, no shielded fee required".dim);
      } else {
        console.error("\nYour shielded balance is insufficient for this transaction.".yellow);
        console.error("\n💡 Solutions:".green.bold);
        console.error("   1. Reduce your unshield amount".white);
        console.error("   2. Shield more BNB first".white);
        console.error("   3. Try self-signing (no broadcaster fee)".white);
      }
      
      console.error("\n=".repeat(60).yellow + "\n");
      return undefined;
    }
    
    // Generic error handler for other errors
    console.error("\n" + "=".repeat(60).red);
    console.error("⚠️  Error during unshield base token proof generation/population".red.bold);
    console.error(error.message.yellow);
    if (error.stack) {
      console.error("\nStack trace:".dim);
      console.error(error.stack.split('\n').slice(0, 5).join('\n').dim);
    }
    console.error("=".repeat(60).red + "\n");
    return undefined;
  }
};
