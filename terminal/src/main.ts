import { runTopLevelMenu, walletBalancePoller } from "./ui/main-ui";
import {
  clearConsoleBuffer,
  printLogo,
  processSafeExit,
  setConsoleTitle,
} from "./util/error-util";
import { initializeWalletSystems } from "./wallet/wallet-init";
import { latestBalancePoller } from "./wallet/scan-callbacks";
import { overrideMainConfig, versionCheck } from "./config/config-overrides";
import { updateApiKey } from "./transaction/zeroX/0x-swap";
const { version } = require("../package.json");

const main = async () => {
  try {
    await overrideMainConfig(version);
    setConsoleTitle();
    printLogo();
    versionCheck(version);
    updateApiKey();
    
    await initializeWalletSystems().catch(async (err) => {
      console.error("\n" + "=".repeat(60).red);
      console.error("⚠️  Failed to initialize wallet systems".red.bold);
      console.error(((err as Error)?.message || String(err)).yellow);
      console.error("\nExiting...".red);
      console.error("=".repeat(60).red + "\n");
      await processSafeExit();
    });
    
    walletBalancePoller();
    runTopLevelMenu().catch((err) => {
      console.error("\n" + "=".repeat(60).red);
      console.error("⚠️  Fatal error in main menu".red.bold);
      console.error(((err as Error)?.message || String(err)).yellow);
      console.error("\nExiting...".red);
      console.error("=".repeat(60).red + "\n");
      processSafeExit();
    });
    latestBalancePoller(10 * 1000);
  } catch (error) {
    // Last resort error handler
    console.error("\n" + "=".repeat(60).red);
    console.error("⚠️  Fatal error during startup".red.bold);
    console.error(((error as Error)?.message || String(error)).yellow);
    if ((error as Error)?.stack) {
      console.error("\nStack trace:".dim);
      console.error((error as Error).stack?.split('\n').slice(0, 10).join('\n').dim);
    }
    console.error("\nExiting...".red);
    console.error("=".repeat(60).red + "\n");
    await processSafeExit();
  }
};

clearConsoleBuffer();
main().catch(async (err) => {
  console.error("Critical failure:", err);
  await processSafeExit();
});
