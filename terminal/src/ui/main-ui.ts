import { RailgunTransaction } from "../models/transaction-models";
import { getPrivateDisplayBalances } from "../balance/balance-util";
import { getCurrentNetwork } from "../engine/engine";
import { generateAuthPayload } from "../util/sign-util";
import * as tamashii from "../tamashii";
import {
  getChainForName,
  getWrappedTokenInfoForChain,
  remoteConfig,
} from "../network/network-util";
import {
  resetMenuForScan,
  runFreshWalletPrompt,
  switchRailgunNetwork,
  switchRailgunWallet,
} from "../wallet/private-wallet";

import { getCurrentWalletMnemonicAndIndex } from "../wallet/public-utils";
import { initilizeFreshWallet } from "../wallet/wallet-init";
import {
  shouldDisplayPrivateBalances,
  getCurrentRailgunAddress,
  getCurrentRailgunID,
  getCurrentWalletName,
  getCurrentWalletPublicAddress,
  getWalletNames,
  togglePrivateBalances,
  isMenuResponsive,
  toggleResponsiveMenu,
  shouldShowSender,
  toggleShouldShowSender,
} from "../wallet/wallet-util";
import { runTransactionBuilder } from "../transaction/transaction-builder";
import {
  addCustomBroadcaster,
  removeCustomBroadcaster,
  getCustomBroadcasters,
  applyCustomBroadcasters,
} from "../waku/broadcaster-util";

import { runAddKnownAddress } from "./known-address-ui";
import {
  RAILGUN_HEADER,
  clearConsoleBuffer,
  processDestroyExit,
  processSafeExit,
} from "../util/error-util";
import {
  createBox,
  createDivider,
  printWelcome,
  printSection,
  printCwd,
  colors,
} from "../util/style-util";
import { runAddTokenPrompt } from "./token-ui";
import {
  confirmPrompt,
  confirmPromptCatch,
  confirmPromptCatchRetry,
  confirmPromptExit,
} from "./confirm-ui";
import {
  NetworkName,
  RailgunWalletBalanceBucket,
  TXIDVersion,
  delay,
  isDefined,
} from "@railgun-community/shared-models";
import {
  generatePOIsForWallet,
  refreshBalances,
  refreshReceivePOIsForWallet,
  refreshSpentPOIsForWallet,
  rescanFullUTXOMerkletreesAndWallets,
  fullResetTXIDMerkletreesV2,
} from "@railgun-community/wallet";
import {
  clearHashedPassword,
  getSaltedPassword,
} from "../wallet/wallet-password";
import { isWakuConnected, resetWakuClient } from "../waku/connect-waku";
import { getScanProgressString, walletManager } from "../wallet/wallet-manager";
import "colors";
import { getStatusText, setStatusText } from "./status-ui";
import { runRPCEditorPrompt } from "./provider-ui";
import { launchCodex } from "./codex-ui";
import { runEasePaymentPrompt } from "./ease-payment-ui";
const { version } = require("../../package.json");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Select, Input } = require("enquirer");

const stripColors = (input: string): string => {
  // eslint-disable-next-line no-control-regex
  return input.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, "");
};

let lastMenuSelection: string | undefined = undefined;

export const runWalletSelectionPrompt = async (): Promise<boolean> => {
  const walletNames = getWalletNames().map((name) => {
    return {
      name,
      message:
        getCurrentWalletName() === name ? `${name} ${"(Active)".dim}` : name,
    };
  });
  const switchOptionPrompt = new Select({
    header: ` `,
    message: "Switching Wallet",
    format: " ",
    default: " ",
    choices: walletNames,
    multiple: false,
  });
  const switchOption = await switchOptionPrompt.run().catch(confirmPromptCatch);
  if (switchOption) {
    try {
      const switchResult = await switchRailgunWallet(switchOption);
      if (!isDefined(switchResult)) {
        return false;
      }
      if (isDefined(switchResult) && switchResult === true) {
        return true;
      }
    } catch (error) {
      console.log("Failed during switch...");
    }
  }

  const retry = await confirmPrompt(`Try Selection Again?`, {
    initial: false,
  });
  if (retry) {
    return runWalletSelectionPrompt();
  }
  return false;
};

const runNetworkSelectionPrompt = async () => {
  // Add logging to track where it fails
  console.log("[DEBUG] Starting network selection prompt");
  
  try {
    const selectNetworkPrompt = new Select({
      header: " ",
      message: "Network Selection",
      choices: [
        { name: NetworkName.Ethereum, message: `${"Ethereum".green} Network` },
        { name: NetworkName.BNBChain, message: `${"Binance".green} Network` },
        { name: NetworkName.Polygon, message: `${"Polygon".green} Network` },
        { name: NetworkName.Arbitrum, message: `${"Arbitrum".green} Network` },
        // {
        //   name: NetworkName.EthereumGoerli_DEPRECATED,
        //   message: `${"Ethereum Görli".green} Testnet`,
        // },
        // {
        //   name: NetworkName.ArbitrumGoerli_DEPRECATED,
        //   message: `${"Arbitrum Görli".green} Testnet`,
        // },
        { name: "exit-menu", message: "Go Back".grey },
      ],
      multiple: false,
    });
    
    console.log("[DEBUG] Prompt created, waiting for selection");
    const selectedNetwork = await selectNetworkPrompt
      .run()
      .catch((err: any) => {
        console.error("[DEBUG] Prompt error:", err?.message || String(err));
        // User cancelled or prompt errored
        return undefined;
      });
    
    console.log("[DEBUG] Selected network:", selectedNetwork);
    
    if (!selectedNetwork || selectedNetwork === "exit-menu") {
      console.log("[DEBUG] No network selected or exit chosen");
      return;
    }
    
    // Validate network name
    const validNetworks = [
      NetworkName.Ethereum,
      NetworkName.BNBChain,
      NetworkName.Polygon,
      NetworkName.Arbitrum,
    ];
    if (!validNetworks.includes(selectedNetwork as NetworkName)) {
      console.error("[DEBUG] Invalid network selected:", selectedNetwork);
      console.error("\n" + "=".repeat(60).red);
      console.error("⚠️  Invalid network selected".red.bold);
      console.error(`Selected: ${selectedNetwork}`.yellow);
      console.error("=".repeat(60).red + "\n");
      await confirmPromptCatchRetry("Press ENTER to continue");
      return;
    }
    
    console.log("[DEBUG] Starting network switch to:", selectedNetwork);
    try {
      setStatusText("Switching network...".yellow);
      
      // Wrap in a timeout to catch hanging operations
      const switchPromise = switchRailgunNetwork(selectedNetwork as NetworkName);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Network switch timed out after 30 seconds")), 30000);
      });
      
      await Promise.race([switchPromise, timeoutPromise]).catch((err) => {
        // Re-throw with more context
        const errorMsg = (err as Error)?.message || String(err);
        throw new Error(`Network switch failed: ${errorMsg}`);
      });
      
      console.log("[DEBUG] Network switch completed successfully");
      setStatusText(`Switched to ${selectedNetwork} network`.green, 3000);
    } catch (err) {
      console.error("[DEBUG] Error during network switch:", err);
      const errorMessage = (err as Error)?.message || String(err);
      const stackTrace = (err as Error)?.stack;
      
      console.error("\n" + "=".repeat(60).red);
      console.error("⚠️  Error switching network".red.bold);
      console.error(`Network: ${selectedNetwork}`.yellow);
      console.error(`Error: ${errorMessage}`.yellow);
      if (stackTrace) {
        console.error("\nStack trace:".dim);
        console.error(stackTrace.split('\n').slice(0, 10).join('\n').dim);
      }
      console.error("=".repeat(60).red + "\n");
      
      setStatusText(`Failed to switch network: ${errorMessage}`.red, 5000);
      await confirmPromptCatchRetry("Press ENTER to continue");
    }
  } catch (err) {
    console.error("[DEBUG] Unexpected error in network selection:", err);
    const errorMessage = (err as Error)?.message || String(err);
    const stackTrace = (err as Error)?.stack;
    
    console.error("\n" + "=".repeat(60).red);
    console.error("⚠️  Unexpected error in network selection".red.bold);
    console.error(errorMessage.yellow);
    if (stackTrace) {
      console.error("\nStack trace:".dim);
      console.error(stackTrace.split('\n').slice(0, 10).join('\n').dim);
    }
    console.error("=".repeat(60).red + "\n");
    
    try {
      await confirmPromptCatchRetry("Press ENTER to continue");
    } catch (confirmErr) {
      console.error("[DEBUG] Error in confirmation:", confirmErr);
    }
  }
};

const runPOIToolsPrompt = async (chainName: NetworkName) => {
  const generateOptionPrompt = new Select({
    header: " ",
    message: "POI Tools",
    choices: [
      {
        name: "generate-wallet-poi",
        message: `Generate Wallet POI ${walletManager?.poiProgressEvent?.status}`,
      },
      {
        name: "refresh-poi-recieved",
        message: "Refresh Received POI",
      },
      {
        name: "refresh-poi-spent",
        message: "Refresh Spent POI",
      },
      { name: "exit-menu", message: "Go Back".grey },
    ],
    multiple: false,
  });
  const generateOption = await generateOptionPrompt
    .run()
    .catch(confirmPromptCatch);
  if (generateOption) {
    switch (generateOption) {
      case "generate-wallet-poi": {
        await generatePOIsForWallet(chainName, getCurrentRailgunID());
        break;
      }
      case "refresh-poi-spent": {
        await refreshSpentPOIsForWallet(
          TXIDVersion.V2_PoseidonMerkle,
          chainName,
          getCurrentRailgunID(),
        );
        break;
      }
      case "refresh-poi-recieved": {
        await refreshReceivePOIsForWallet(
          TXIDVersion.V2_PoseidonMerkle,
          chainName,
          getCurrentRailgunID(),
        );
        break;
      }
      default: {
        break;
      }
    }
  }
};

const runWalletToolsPrompt = async (chainName: NetworkName) => {
  const currentShowStatus = `[${shouldShowSender() ? "SHOWING".green : "HIDING".grey}]`
  const generateOptionPrompt = new Select({
    header: " ",
    message: "Wallet Tools",
    choices: [
      { name: "add-wallet", message: "Add Wallet" },
      { name: "poi-tools", message: "POI Tools" },
      { name: "show-sender-address", message: `${currentShowStatus} ${shouldShowSender() ? "Hide" : "Show"} Private TX Sender address.` },
      {
        name: "show-mnemonic",
        message: "Show Current Mnemonic & Index",
      },
      { name: 'full-txid-rescan', message: "Full TXID Rescan" },
      { name: "full-balance-rescan", message: "Full Balance Rescan" },
      {
        name: "destruct-wallet",
        message: "WIPE ALL DATA... DANGER!!! DANGER!!!",
        hint: "This Will Destroy your terminal wallet cache and railgun wallet database.",
      },
      { name: "exit-menu", message: "Go Back".grey },
    ],
    multiple: false,
  });
  const generateOption = await generateOptionPrompt
    .run()
    .catch(confirmPromptCatch);
  if (generateOption) {
    switch (generateOption) {
      case "show-sender-address": {
        toggleShouldShowSender();
        await confirmPromptCatchRetry("Updated... please continue.");
        break;
      }
      case "add-wallet": {
        const newWalletInfo = await runFreshWalletPrompt(chainName);
        if (newWalletInfo) {
          console.log(newWalletInfo);
          await confirmPromptCatchRetry("");
        }
        break;
      }
      case "poi-tools": {
        await runPOIToolsPrompt(chainName);
        break;
      }
      case "show-mnemonic": {
        const walletInfo = await getCurrentWalletMnemonicAndIndex();
        if (isDefined(walletInfo)) {
          console.log(walletInfo);
          await confirmPromptCatchRetry("");
        }
        break;
      }
      case "full-txid-rescan": {
        try {
          await fullResetTXIDMerkletreesV2(chainName);
          await confirmPromptCatchRetry("TXID Merkle trees reset. Rescanning...");
        } catch (err) {
          const errorMessage = (err as Error)?.message || String(err);
          await confirmPromptCatchRetry(
            `Error resetting TXID Merkle trees: ${errorMessage}`.red
          );
        }
        break;
      }
      case "full-balance-rescan": {
        try {
          const chain = getChainForName(chainName);
          const railgunWalletID = getCurrentRailgunID();

          resetMenuForScan();
          await rescanFullUTXOMerkletreesAndWallets(chain, [railgunWalletID]);
          await confirmPromptCatchRetry("Full balance rescan initiated...");
        } catch (err) {
          const errorMessage = (err as Error)?.message || String(err);
          await confirmPromptCatchRetry(
            `Error during full balance rescan: ${errorMessage}`.red
          );
        }
        break;
      }
      case "destruct-wallet": {
        const confirmDestroy1 = await confirmPrompt(
          "Are you sure you wish to DESTROY your wallet DATA?",
        );
        if (confirmDestroy1) {
          const confirmDestroy2 = await confirmPrompt(
            "You're Okay with this?",
            { hint: " | Theres NO recovering after this..." },
          );
          if (confirmDestroy2) {
            const confirmPassword = await getSaltedPassword();
            if (isDefined(confirmPassword)) {
              setStatusText(
                "SELF DESTRUCT ENABLED... scheduled in 3..2...1....",
                3000,
              );
              setTimeout(() => {
                processDestroyExit();
              }, 4000);
            }
          }
        }
        break;
      }
      default: {
        break;
      }
    }
  }
};

/**
 * Broadcaster Settings Menu
 * Allows users to add their own broadcaster for private transaction relaying
 */
const runBroadcasterSettingsPrompt = async () => {
  const customBroadcasters = getCustomBroadcasters();
  
  console.log("\n" + "=".repeat(60).cyan);
  console.log("📡 Broadcaster Settings".cyan.bold);
  console.log("=".repeat(60).cyan);
  console.log("\nCustom broadcasters allow you to use your own broadcaster node");
  console.log("for maximum privacy and reliability.\n");
  
  if (customBroadcasters.length > 0) {
    console.log("Your Custom Broadcasters:".green);
    customBroadcasters.forEach((addr, i) => {
      console.log(`  ${i + 1}. ${addr.slice(0, 20)}...${addr.slice(-10)}`.cyan);
    });
    console.log("");
  } else {
    console.log("No custom broadcasters configured.".grey);
    console.log("Add your own broadcaster to ensure reliable private transactions.\n");
  }
  
  const broadcasterSettingsPrompt = new Select({
    header: " ",
    message: "Broadcaster Options",
    choices: [
      { name: "add", message: "Add Custom Broadcaster".green },
      { name: "remove", message: "Remove Custom Broadcaster".yellow },
      { name: "view", message: "View All Broadcasters".cyan },
      { name: "refresh", message: "Refresh Broadcaster List".grey },
      { name: "back", message: "Back to Main Menu".grey },
    ],
  });
  
  const selection = await broadcasterSettingsPrompt.run().catch(confirmPromptCatch);
  
  if (!selection || selection === "back") {
    return;
  }
  
  switch (selection) {
    case "add": {
      console.log("\n" + "=".repeat(60).green);
      console.log("Add Custom Broadcaster".green.bold);
      console.log("=".repeat(60).green);
      console.log("\nEnter your broadcaster's Railgun address (starts with 0zk...)");
      console.log("You can find this in your broadcaster node's console output.\n");
      
      const addressPrompt = new Input({
        message: "Broadcaster Railgun Address:",
        validate: (value: string) => {
          if (!value || value.length === 0) {
            return "Address is required";
          }
          if (!value.startsWith("0zk")) {
            return "Must be a Railgun address (starts with 0zk)";
          }
          if (value.length < 50) {
            return "Invalid Railgun address - too short";
          }
          return true;
        },
      });
      
      const broadcasterAddress = await addressPrompt.run().catch(confirmPromptCatch);
      
      if (broadcasterAddress) {
        try {
          addCustomBroadcaster(broadcasterAddress);
          console.log("\n✅ Broadcaster added successfully!".green);
          console.log("Your broadcaster will now be available for transactions.".grey);
        } catch (err) {
          console.error("\n❌ Failed to add broadcaster:".red, (err as Error)?.message);
        }
      }
      
      await confirmPromptCatchRetry("Press ENTER to continue...");
      break;
    }
    case "remove": {
      if (customBroadcasters.length === 0) {
        console.log("\nNo custom broadcasters to remove.".yellow);
        await confirmPromptCatchRetry("Press ENTER to continue...");
        break;
      }
      
      const removeChoices = customBroadcasters.map((addr, i) => ({
        name: addr,
        message: `${addr.slice(0, 20)}...${addr.slice(-10)}`,
      }));
      removeChoices.push({ name: "cancel", message: "Cancel".grey });
      
      const removePrompt = new Select({
        header: " ",
        message: "Select broadcaster to remove",
        choices: removeChoices,
      });
      
      const toRemove = await removePrompt.run().catch(confirmPromptCatch);
      
      if (toRemove && toRemove !== "cancel") {
        removeCustomBroadcaster(toRemove);
        console.log("\n✅ Broadcaster removed.".yellow);
      }
      
      await confirmPromptCatchRetry("Press ENTER to continue...");
      break;
    }
    case "view": {
      console.log("\n" + "=".repeat(60).cyan);
      console.log("All Configured Broadcasters".cyan.bold);
      console.log("=".repeat(60).cyan);
      
      console.log("\n📡 Custom Broadcasters:".green);
      if (customBroadcasters.length > 0) {
        customBroadcasters.forEach((addr, i) => {
          console.log(`  ${i + 1}. ${addr}`.cyan);
        });
      } else {
        console.log("  (none)".grey);
      }
      
      console.log("\n📡 Network Broadcasters:".yellow);
      console.log("  Available broadcasters will be fetched when making a transaction.".grey);
      console.log("  Use 'List All Available Broadcasters' in the fee menu.".grey);
      
      await confirmPromptCatchRetry("\nPress ENTER to continue...");
      break;
    }
    case "refresh": {
      console.log("\nRefreshing broadcaster list...".yellow);
      applyCustomBroadcasters();
      console.log("✅ Broadcaster list refreshed.".green);
      await confirmPromptCatchRetry("Press ENTER to continue...");
      break;
    }
  }
};

/**
 * Prompt for signing in to Tamashi Network
 */
const runTamashiSignInPrompt = async () => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log("\n" + "=".repeat(60).yellow);
    console.log("Tamashi Network".yellow.bold);
    console.log("=".repeat(60).yellow);

    // Show current status
    const isAuth = tamashii.isAuthenticated();
    const activeGpu = tamashii.getActiveSession();

    console.log("\n📊 Status:".white);
    console.log(`   Auth:     ${isAuth ? "Signed In".green : "Not signed in".yellow}`);
    console.log(`   Wallet:   ${getCurrentWalletName() || "Not connected".yellow}`);
    if (isAuth) {
      try {
        const balance = await tamashii.getBalance();
        console.log(`   Balance:  ${balance.balance_bnb.toFixed(6)} BNB ($${balance.balance_usd.toFixed(2)})`.cyan);
      } catch {
        console.log(`   Balance:  Unable to fetch`.grey);
      }
    }
    if (activeGpu) {
      console.log(`   GPU:      ${"Running".green} - ${activeGpu.hostname}`.cyan);
    }

    // Build menu choices based on state
    const choices: any[] = [];

    if (!isAuth) {
      choices.push({ name: "sign-in", message: "Sign In with Wallet".green });
    } else {
      choices.push({ name: "view-balance", message: "View Balance".cyan });
      if (!activeGpu) {
        choices.push({ name: "launch-gpu", message: "Launch GPU (vLLM)".green });
      } else {
        choices.push({ name: "connect-gpu", message: `Connect to GPU (${activeGpu.hostname.slice(0, 20)}...)`.green });
        choices.push({ name: "gpu-status", message: "GPU Status".cyan });
      }
      choices.push({ name: "sign-out", message: "Sign Out".yellow });
    }
    choices.push({ name: "deposit-info", message: "Deposit Info".grey });
    choices.push({ name: "back", message: "Back to Main Menu".grey });

    const signInPrompt = new Select({
      header: " ",
      message: "Tamashi Options",
      choices,
    });

    const selection = await signInPrompt.run().catch(confirmPromptCatch);

    if (!selection || selection === "back") {
      return;
    }

    switch (selection) {
      case "sign-in": {
        const railgunAddress = getCurrentRailgunAddress();
        if (!railgunAddress) {
          console.log("\n❌ No wallet found. Please create a wallet first.".red);
          await confirmPromptCatchRetry("Press ENTER to continue...");
          break;
        }

        console.log("\n🔐 Signing with your wallet...".yellow);

        try {
          const authData = await generateAuthPayload();
          console.log("   Authenticating with Tamashi backend...".grey);

          await tamashii.authenticate(
            authData.message,
            authData.signature,
            authData.address
          );

          console.log("\n✅ Successfully signed in to Tamashi Network!".green);
          const balance = await tamashii.getBalance();
          console.log(`   Balance: ${balance.balance_bnb.toFixed(6)} BNB ($${balance.balance_usd.toFixed(2)})`.cyan);

        } catch (err) {
          console.error("\n❌ Failed to sign in:".red, (err as Error)?.message);
        }

        await confirmPromptCatchRetry("\nPress ENTER to continue...");
        break;
      }

      case "view-balance": {
        try {
          const balance = await tamashii.getBalance();
          console.log("\n💰 Tamashi Balance:".cyan);
          console.log(`   Deposits: ${balance.deposits_bnb.toFixed(6)} BNB`.white);
          console.log(`   Spent:    ${balance.spent_bnb.toFixed(6)} BNB`.white);
          console.log(`   Balance:  ${balance.balance_bnb.toFixed(6)} BNB ($${balance.balance_usd.toFixed(2)})`.green);
        } catch (err) {
          console.error("\n❌ Failed to fetch balance:".red, (err as Error)?.message);
        }
        await confirmPromptCatchRetry("\nPress ENTER to continue...");
        break;
      }

      case "launch-gpu": {
        console.log("\n🚀 Launching GPU Instance...".yellow);
        console.log("   Model: NousResearch/Hermes-3-Llama-3.2-3B".grey);
        console.log("   GPU:   L4".grey);
        console.log("   Time:  10 minutes".grey);

        try {
          const result = await tamashii.launchVllm({
            model: "NousResearch/Hermes-3-Llama-3.2-3B",
            gpuType: "l4",
            duration: 600,
          });

          console.log("\n✅ GPU Job Launched!".green);
          console.log(`   Job ID:  ${result.jobId}`.grey);
          console.log(`   C3 Job:  ${result.c3JobId}`.grey);
          console.log(`   Cost:    ${result.costBnb.toFixed(6)} BNB ($${result.costUsd.toFixed(2)})`.cyan);
          console.log(`   API Key: ${result.apiKey}`.yellow);

          console.log("\n⏳ Waiting for GPU to start (this may take 1-2 minutes)...".yellow);
          console.log("   The hostname will be displayed once ready.".grey);
          console.log("   You can also check the C3 dashboard for status.".grey);

          // Store partial session - hostname will be added when user connects
          tamashii.setActiveSession({
            jobId: result.jobId,
            c3JobId: result.c3JobId,
            hostname: "", // Will be set when connecting
            apiKey: result.apiKey,
            model: "hermes3:3b",
          });

        } catch (err) {
          console.error("\n❌ Failed to launch GPU:".red, (err as Error)?.message);
        }

        await confirmPromptCatchRetry("\nPress ENTER to continue...");
        break;
      }

      case "connect-gpu": {
        if (!activeGpu) {
          console.log("\n❌ No active GPU session.".red);
          await confirmPromptCatchRetry("Press ENTER to continue...");
          break;
        }

        // If hostname not set, prompt for it
        if (!activeGpu.hostname) {
          console.log("\n🔗 Enter the GPU hostname (from C3 dashboard):".yellow);
          const { Input } = require("enquirer");
          const hostnamePrompt = new Input({
            message: "Hostname:",
            initial: "xxx-gpu.compute3.ai",
          });
          const hostname = await hostnamePrompt.run().catch(() => null);
          if (hostname) {
            activeGpu.hostname = hostname;
            tamashii.setActiveSession(activeGpu);
          } else {
            break;
          }
        }

        console.log(`\n🔗 Connecting to ${activeGpu.hostname}...`.yellow);

        // Check if vLLM is ready
        const isReady = await tamashii.checkVllmHealth(activeGpu.hostname, activeGpu.apiKey);
        if (!isReady) {
          console.log("   ❌ vLLM not ready yet. Please wait and try again.".red);
          await confirmPromptCatchRetry("Press ENTER to continue...");
          break;
        }

        console.log("   ✅ vLLM is ready!".green);
        console.log(`\n   Endpoint: https://${activeGpu.hostname}/v1/chat/completions`.cyan);
        console.log(`   API Key:  ${activeGpu.apiKey}`.yellow);
        console.log(`   Model:    ${activeGpu.model}`.grey);

        await confirmPromptCatchRetry("\nPress ENTER to continue...");
        break;
      }

      case "gpu-status": {
        if (!activeGpu) {
          console.log("\n❌ No active GPU session.".red);
        } else {
          console.log("\n🖥️  GPU Session:".cyan);
          console.log(`   Job ID:   ${activeGpu.jobId}`.grey);
          console.log(`   C3 Job:   ${activeGpu.c3JobId}`.grey);
          console.log(`   Hostname: ${activeGpu.hostname || "Not set".yellow}`.white);
          console.log(`   API Key:  ${activeGpu.apiKey}`.yellow);
          console.log(`   Model:    ${activeGpu.model}`.grey);

          if (activeGpu.hostname) {
            const isReady = await tamashii.checkVllmHealth(activeGpu.hostname, activeGpu.apiKey);
            console.log(`   Status:   ${isReady ? "Ready".green : "Not Ready".yellow}`);
          }
        }
        await confirmPromptCatchRetry("\nPress ENTER to continue...");
        break;
      }

      case "sign-out": {
        tamashii.clearJwt();
        tamashii.clearActiveSession();
        console.log("\n✅ Signed out.".green);
        await confirmPromptCatchRetry("Press ENTER to continue...");
        break;
      }

      case "deposit-info": {
        console.log("\n💳 Deposit Information:".cyan);
        try {
          const addr = await tamashii.getDepositAddress();
          console.log("\n   Send BNB to this Railgun address to deposit:".white);
          console.log(`   ${addr.railgunAddress}`.green);
          console.log("\n   Or send to public EVM address:".white);
          console.log(`   ${addr.evmAddress}`.yellow);
        } catch (err) {
          console.error("\n❌ Failed to fetch deposit address:".red, (err as Error)?.message);
        }
        await confirmPromptCatchRetry("\nPress ENTER to continue...");
        break;
      }
    }
  }
};

const getMainPrompt = (networkName: NetworkName, baseSymbol: string) => {

  const chain = getChainForName(networkName);

  return new Select({
    logoHeader: RAILGUN_HEADER,
    header: async () => {
      const broadcasterStatus = `Broadcasters: ${isWakuConnected()
        ? "Available".dim.green.bold
        : "Disconnected".dim.yellow.bold
        }`.grey;

      const walletName = getCurrentWalletName();
      const currentRailgunAddress = getCurrentRailgunAddress();
      const currentPublicAddress = getCurrentWalletPublicAddress();

      const { rows } = process.stdout;

      const walletInfoString = `${"Wallet".grey}: ${walletName}
[Private] ${currentRailgunAddress.grey}
[Public ] ${currentPublicAddress.grey}
      `;

      const statusString = getStatusText();
      const scanString = getScanProgressString();
      const balanceScanned =
        scanString === "" ? statusString : `${scanString}${statusString}`;
      const buckets = Object.keys(RailgunWalletBalanceBucket);

      let balanceBlock = ""
      for (const bucket of buckets) {
        const output = await getPrivateDisplayBalances(networkName, bucket as RailgunWalletBalanceBucket).then(
          (v) => {
            return v;
          },
        );

        const outputstring = `${output}`;
        balanceBlock += `${outputstring}`
      }

      return [
        "",
        walletInfoString,
        broadcasterStatus,
        balanceBlock,
        `${!isMenuResponsive()
          ? "Auto Refresh Disabled, Refresh on Movement Enabled.\n".yellow.dim
          : ""
        }${balanceScanned}`,
      ].join("\n");
    },
    format() {
      return " ";
    },
    right() {
      if (this.index > 10) {
        this.index = this.choices.length - 1;
      } else {
        this.index += 12;
      }
      if (this.isDisabled()) {
        return this.down();
      }
      return this.index;
    },
    left() {
      if (this.index > 11) {
        this.index -= 12;
      } else {
        if (this.index < 11) {
          this.index += 12;
        } else {
          this.index = this.choices.length - 1;
        }
      }
      if (this.isDisabled()) {
        return this.down();
      }
      return this.index;
    },
    async render() {
      const { submitted, size } = this.state;

      let prompt = "";
      const header = await this.header();
      const prefix = await this.prefix();
      const separator = await this.separator();
      const message = await this.message();

      if (this.options.promptLine !== false) {
        prompt = [prefix, message, separator, ""].join(" ");
        this.state.prompt = prompt;
      }

      const output = await this.format();
      const help = (await this.error()) || (await this.hint());
      const body = await this.renderChoices();
      const footer = await this.footer();

      if (output) prompt += output;
      if (help && !prompt.includes(help)) prompt += " " + help;

      if (
        submitted &&
        !output &&
        !body.trim() &&
        this.multiple &&
        this.emptyError != null
      ) {
        prompt += this.styles.danger(this.emptyError);
      }

      this.clear(size);
      this.write(
        [this.logoHeader, prompt, "", header, body, footer]
          .filter(Boolean)
          .join("\n"),
      );
      this.write(this.margin[2]);
      this.restore();
    },
    async renderChoices() {
      if (this.state.submitted) return " ";

      const choices = this.visible.map(
        async (ch: any, i: number) => await this.renderChoice(ch, i),
      );
      const visible = await Promise.all(choices);

      // Simple vertical list for simplified menu
      return visible.join("\n");
    },
    async keypress(input: any, key = input ?? {}) {
      const now = Date.now();
      const elapsed = now - this.lastKeypress;
      this.lastKeypress = now;
      const isEnterKey = key.name === "return" || key.name === "enter";
      const isESCKey = key.name === "escape";
      this.state.prevKeypress = key;

      const isLeft = key.name == "left";
      const isRight = key.name == "right";
      const isUp = key.name == "up";
      const isDown = key.name == "down";
      if (isLeft) {
        this.left();
      }
      if (isRight) {
        this.right();
      }

      if (isUp) {
        this.up();
      }

      if (isDown) {
        this.down();
      }

      if (isEnterKey) {
        this.submit();
      }
      return this.render();
    },
    prefix: process.platform === "win32" ? " [*]" : "🛡️ ",
      message: `Now arriving at TAMASHI ${("v" + version).grey}... ${"privacy llm".grey
      }`,
    separator: " ",
    initial: lastMenuSelection ?? "create-wallet",
    choices: [
      { name: "create-wallet", message: "Create Wallet".cyan.bold },
      { name: "base-shield", message: `Shield [${baseSymbol.cyan.bold}]` },
      { name: "base-unshield", message: `Unshield [${baseSymbol.cyan.bold}]` },
      { name: "private-transfer", message: "Private Transfer [0zk → 0zk]".magenta },
      { name: "ease-payment", message: "Pay EASE".cyan },
      { name: "balance", message: "View Balance".cyan },
      { name: "tamashi-signin", message: "Sign in to Tamashi Network".yellow },
      { name: "broadcaster-settings", message: "Broadcaster Settings".grey },
      {
        name: "exit",
        message: `Exit${process.platform === "win32" ? "?" : " 💫"}`.grey,
      },
    ],
    multiple: false,
  });
};

const BufferManager = {
  lastClearTime: 0,
  clear() {
    const nowTime = Date.now();
    const timeDifference = nowTime - this.lastClearTime;
    if (timeDifference > 1 * 1000) {
      if (process.stdout.rows < 50) {
        this.lastClearTime = nowTime;
        clearConsoleBuffer();
      }
    }
  },
};

export const walletBalancePoller = async () => {
  try {
    const networkName = getCurrentNetwork();
    const chain = getChainForName(networkName);
    const railgunWalletID = getCurrentRailgunID();
    
    // Add timeout for background polling (60 seconds)
    const refreshPromise = refreshBalances(chain, [railgunWalletID]);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Background balance refresh timed out")), 60000);
    });
    
    await Promise.race([refreshPromise, timeoutPromise]).catch((err) => {
      // Silently handle errors in background polling - don't spam console
      const errorMessage = (err as Error)?.message || String(err);
      // Only log if it's not a known non-critical error
      if (!errorMessage.includes("could not coalesce") && 
          !errorMessage.includes("already held by process") &&
          !errorMessage.includes("timed out") &&
          !errorMessage.includes("V2 events")) {
        // Log to status text instead of console to avoid spam
        setStatusText(
          `Balance refresh: ${errorMessage.substring(0, 40)}...`.yellow,
          3000,
        );
      }
    });
  } catch (err) {
    // Silently continue polling even if there's an error
    // Don't let background polling crash the CLI
  }
  await delay(5 * 60 * 1000); // 5 minute polling delay for balance refreshes
  walletBalancePoller();
};

/**
 * Top-level menu with Privacy Wallet and Privacy AI options
 */
export const runTopLevelMenu = async (): Promise<void> => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      clearConsoleBuffer();
      
      const networkName = getCurrentNetwork();
    const { symbol: baseSymbol } = getWrappedTokenInfoForChain(networkName);
    const balances = await getPrivateDisplayBalances(
      networkName,
      RailgunWalletBalanceBucket.Spendable,
    );
    const scanProgress = getScanProgressString();
    const statusText = getStatusText();
    const wakuStatus = isWakuConnected() 
      ? colors.success("Connected") 
      : colors.error("Disconnected");
    
    // Print welcome with styled box
    printWelcome("TAMASHI", "privacy llm");
    printCwd(process.cwd());
    
    const topLevelPrompt = new Select({
      logoHeader: "",
      header: async () => {
        const infoBox = createBox(
          [
            `Network: ${colors.primary(networkName)} | Waku: ${wakuStatus} | Base Token: ${colors.primary(baseSymbol)}`,
            scanProgress ? scanProgress : "",
            statusText ? statusText : "",
            balances ? balances : "",
          ].filter(Boolean),
          { color: "primary", padding: 1 }
        );
        return "\n" + infoBox + "\n";
      },
      message: colors.primary("Select an option"),
      choices: [
        {
          name: "privacy-wallet",
          message: colors.primary("🔒 Privacy Wallet"),
          hint: "Manage your private wallet, transactions, and balances",
        },
        {
          name: "privacy-ai",
          message: colors.primary("🤖 Privacy AI"),
          hint: "AI assistant powered by Tamashii",
        },
        {
          name: "exit",
          message: colors.error("Exit"),
        },
      ],
      multiple: false,
    });

    const selection = await topLevelPrompt.run().catch(async (err: any) => {
      const confirm = await confirmPromptExit(`Do you wish to EXIT?`, {
        initial: true,
      });
      if (!isDefined(confirm) || confirm) {
        clearConsoleBuffer();
        await processSafeExit();
      }
      return null;
    });

    if (!selection) {
      continue;
    }

    switch (selection) {
      case "privacy-wallet":
        await runWalletMenu();
        break;
      case "privacy-ai":
        await launchCodex();
        // After Tamashii exits, return to top-level menu
        await confirmPromptCatchRetry("Press ENTER to return to main menu");
        break;
      case "exit":
        await processSafeExit();
        return;
      default:
        break;
    }
    } catch (error) {
      // Catch any errors in the menu loop and recover
      const err = error as Error;
      console.error("\n" + "=".repeat(60).red);
      console.error("⚠️  Error in menu:".red.bold);
      console.error(err.message.yellow);
      console.error("\nReturning to main menu in 3 seconds...".green);
      console.error("=".repeat(60).red + "\n");
      
      // Wait a bit before continuing
      await delay(3000);
      // Continue the loop - don't exit
    }
  }
};

/**
 * Original wallet menu (renamed from runMainMenu)
 */
export const runWalletMenu = async () => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      clearHashedPassword();
      const networkName = getCurrentNetwork();
      clearConsoleBuffer();

      const { symbol: baseSymbol } = getWrappedTokenInfoForChain(networkName);
      const mainPrompt = getMainPrompt(networkName, baseSymbol);

      const bufferMgr = BufferManager;

      if (isMenuResponsive()) {
        mainPrompt.once("close", () => clearTimeout(mainPrompt.state.timeout));
        const pulse = (interval: number) => {
          mainPrompt.state.timeout = setTimeout(async () => {
            bufferMgr.clear();
            mainPrompt.render();
            pulse(interval);
          }, interval);
        };
        mainPrompt.on("run", () => {
          pulse(1250);
        });
      }

      mainPrompt.on("submit", () => {
        clearConsoleBuffer();
      });

      const menuSelection = await mainPrompt.run().catch(async (err: any) => {
        const confirm = await confirmPromptExit(`Do you wish to EXIT?`, {
          initial: true,
        });
        if (!isDefined(confirm) || confirm) {
          clearConsoleBuffer();
          await processSafeExit();
          return false;
        }
        return false;
      });

      // Safety check: If menuSelection is somehow undefined or incorrect, continue loop
      if (!menuSelection || menuSelection === false) {
        // Menu was cancelled or errored, continue to show menu again
        continue;
      }

      // Update last menu selection for persistence
      if (isDefined(menuSelection)) {
        switch (menuSelection) {
          case "toggle-balance":
          case "reset-broadcasters":
          case "toggle-responsive":
          case "refresh-balances":
            lastMenuSelection = menuSelection;
            break;
          default:
            lastMenuSelection = undefined;
            break;
        }
      }

      switch (menuSelection) {
    case "create-wallet": {
      try {
        const wallet = await initilizeFreshWallet(false);
        if (wallet) {
          setStatusText("Wallet created successfully!".green, 3000);
          await confirmPromptCatchRetry("Wallet created. Press ENTER to continue");
        } else {
          await confirmPromptCatchRetry("Wallet creation cancelled. Press ENTER to continue");
        }
      } catch (err) {
        const errorMessage = (err as Error)?.message || String(err);
        console.error("\n" + "=".repeat(60).red);
        console.error("⚠️  Error creating wallet".red.bold);
        console.error(errorMessage.yellow);
        console.error("=".repeat(60).red + "\n");
        await confirmPromptCatchRetry(`Error: ${errorMessage}`.red);
      }
      break;
    }
    case "base-shield": {
      try {
        const shield_base = await runTransactionBuilder(
          networkName,
          RailgunTransaction.ShieldBase,
        );
      } catch (err) {
        const errorMessage = (err as Error)?.message || String(err);
        console.error("\n" + "=".repeat(60).red);
        console.error("⚠️  Error in base shield transaction".red.bold);
        console.error(errorMessage.yellow);
        console.error("=".repeat(60).red + "\n");
        await confirmPromptCatchRetry(`Error: ${errorMessage}`.red);
      }
      break;
    }
    case "base-unshield": {
      try {
        const unshield_base = await runTransactionBuilder(
          networkName,
          RailgunTransaction.UnshieldBase,
        );
      } catch (err) {
        const errorMessage = (err as Error)?.message || String(err);
        console.error("\n" + "=".repeat(60).red);
        console.error("⚠️  Error in base unshield transaction".red.bold);
        console.error(errorMessage.yellow);
        console.error("=".repeat(60).red + "\n");
        await confirmPromptCatchRetry(`Error: ${errorMessage}`.red);
      }
      break;
    }
    case "private-transfer": {
      try {
        console.log("\n🔒 Private Transfer [0zk → 0zk]".magenta.bold);
        console.log("Send shielded tokens to another Railgun address.\n".dim);
        await runTransactionBuilder(
          networkName,
          RailgunTransaction.Transfer,
        );
      } catch (err) {
        const errorMessage = (err as Error)?.message || String(err);
        console.error("\n" + "=".repeat(60).red);
        console.error("⚠️  Error in private transfer".red.bold);
        console.error(errorMessage.yellow);
        console.error("=".repeat(60).red + "\n");
        await confirmPromptCatchRetry(`Error: ${errorMessage}`.red);
      }
      break;
    }
    case "ease-payment": {
      try {
        await runEasePaymentPrompt();
      } catch (err) {
        const errorMessage = (err as Error)?.message || String(err);
        console.error("\n" + "=".repeat(60).red);
        console.error("⚠️  Error in EASE payment".red.bold);
        console.error(errorMessage.yellow);
        console.error("=".repeat(60).red + "\n");
        await confirmPromptCatchRetry(`Error: ${errorMessage}`.red);
      }
      break;
    }
    case "balance": {
      try {
        const chain = getChainForName(networkName);
        const railgunWalletID = getCurrentRailgunID();
        resetMenuForScan();
        setStatusText("Refreshing balances...".yellow);
        
        // Refresh balances
        const refreshPromise = refreshBalances(chain, [railgunWalletID]);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Balance refresh timed out")), 90000);
        });
        
        await Promise.race([refreshPromise, timeoutPromise]).catch((err) => {
          const errorMessage = (err as Error)?.message || String(err);
          if (!errorMessage.includes("timed out") && !errorMessage.includes("V2 events")) {
            console.error("\n" + "=".repeat(60).red);
            console.error("⚠️  Error refreshing balances".red.bold);
            console.error(errorMessage.yellow);
            console.error("=".repeat(60).red + "\n");
          }
        });
        
        setStatusText("Balances refreshed".green, 3000);
        await confirmPromptCatchRetry("Press ENTER to view balances in menu");
      } catch (err) {
        const errorMessage = (err as Error)?.message || String(err);
        console.error("\n" + "=".repeat(60).red);
        console.error("⚠️  Error viewing balance".red.bold);
        console.error(errorMessage.yellow);
        console.error("=".repeat(60).red + "\n");
        await confirmPromptCatchRetry(`Error: ${errorMessage}`.red);
      }
      break;
    }
    case "tamashi-signin": {
      try {
        await runTamashiSignInPrompt();
      } catch (err) {
        const errorMessage = (err as Error)?.message || String(err);
        if (!errorMessage.includes("Going back")) {
          console.error("\n" + "=".repeat(60).red);
          console.error("⚠️  Error signing in to Tamashi Network".red.bold);
          console.error(errorMessage.yellow);
          console.error("=".repeat(60).red + "\n");
          await confirmPromptCatchRetry(`Error: ${errorMessage}`.red);
        }
      }
      break;
    }
    case "broadcaster-settings": {
      try {
        await runBroadcasterSettingsPrompt();
      } catch (err) {
        const errorMessage = (err as Error)?.message || String(err);
        if (!errorMessage.includes("Going back")) {
          console.error("\n" + "=".repeat(60).red);
          console.error("⚠️  Error in broadcaster settings".red.bold);
          console.error(errorMessage.yellow);
          console.error("=".repeat(60).red + "\n");
          await confirmPromptCatchRetry(`Error: ${errorMessage}`.red);
        }
      }
      break;
    }

        case "exit": {
          clearConsoleBuffer();
          await processSafeExit();
          return; // Exit the while loop and function
        }
        default: {
          // Log unexpected menu selections to help debug routing issues
          if (menuSelection && menuSelection !== false) {
            console.error("\n" + "=".repeat(60).yellow);
            console.error("⚠️  Unexpected menu selection:".yellow.bold);
            console.error(`Selected: "${menuSelection}"`.yellow);
            console.error("This menu item may not have a handler.".yellow);
            console.error("=".repeat(60).yellow + "\n");
            await confirmPromptCatchRetry("Unknown menu selection. Returning to menu...");
          }
          // Continue loop to show menu again
          continue;
        }
      }
      
      // After processing a selection (except exit), continue the loop to show menu again
      // No need to call runWalletMenu() recursively - the while loop handles it
      
    } catch (error) {
      // Catch any errors in the wallet menu and recover
      const err = error as Error;
      console.error("\n" + "=".repeat(60).red);
      console.error("⚠️  Error in wallet menu:".red.bold);
      console.error(err.message.yellow);
      if (err.stack) {
        console.error("\nStack trace:".dim);
        console.error(err.stack.split('\n').slice(0, 5).join('\n').dim);
      }
      console.error("\nReturning to menu in 3 seconds...".green);
      console.error("=".repeat(60).red + "\n");
      
      // Wait before continuing
      await delay(3000);
      // Continue the loop - don't exit
      clearConsoleBuffer();
      // Loop will continue automatically
    }
  }
};
