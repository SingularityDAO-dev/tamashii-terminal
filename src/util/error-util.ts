import { stopEngine } from "../engine/engine";
import { rimrafSync } from "rimraf";
import path from "path";
import configDefaults from "../config/config-defaults";
import { stopWakuClient } from "../waku/connect-waku";

// BNB Chain golden yellow using ANSI 256 color (220 = gold/BNB yellow)
const bnbYellow = (text: string) => `\x1b[38;5;220m${text}\x1b[0m`;
const bnbGold = (text: string) => `\x1b[1m\x1b[38;5;214m${text}\x1b[0m`;
const dimYellow = (text: string) => `\x1b[2m\x1b[38;5;220m${text}\x1b[0m`;

export const RAILGUN_HEADER = bnbGold(`
 ╔════════════════════════════════════════════════════════════╗
 ║                                                            ║
`) + bnbYellow(`
 ║  ████████╗ █████╗ ███╗   ███╗ █████╗ ███████╗██╗  ██╗██╗   ║
 ║  ╚══██╔══╝██╔══██╗████╗ ████║██╔══██╗██╔════╝██║  ██║██║   ║
 ║     ██║   ███████║██╔████╔██║███████║███████╗███████║██║   ║
 ║     ██║   ██╔══██║██║╚██╔╝██║██╔══██║╚════██║██╔══██║██║   ║
 ║     ██║   ██║  ██║██║ ╚═╝ ██║██║  ██║███████║██║  ██║██║   ║
 ║     ╚═╝   ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝   ║
`) + bnbGold(`
 ║                                                            ║
`) + dimYellow(`
 ║                      ━━ privacy llm ━━                     ║
`) + bnbGold(`
 ║                                                            ║
 ╚════════════════════════════════════════════════════════════╝
`);

export const clearConsoleBuffer = async () => {
  process.stdout.write("\u{033}[2J\u001b[H\u001b[2J\u001b[3J");
};

const killEngineAndWaku = async () => {
  await stopWakuClient();
  await stopEngine();
};

export const processDestroyExit = async () => {
  console.log("Deleting Database And Keychains");
  await killEngineAndWaku();

  const { databasePath, artifactPath, keyChainPath } = configDefaults.engine;

  const fullDBPath = path.join(process.cwd(), databasePath);
  const fullArtifactPath = path.join(process.cwd(), artifactPath);
  const fullKeyChainPath = path.join(process.cwd(), keyChainPath);

  rimrafSync(fullDBPath);
  rimrafSync(fullArtifactPath);
  rimrafSync(fullKeyChainPath);

  clearConsoleBuffer();
  console.log("Goodbye. :(");
};

export const processSafeExit = async () => {
  console.log("Shutting Down Modules");
  clearConsoleBuffer();
  await killEngineAndWaku();
  console.clear();
  process.exit(0);
};

process.on("SIGINT", async () => {
  console.clear();
  await processSafeExit();
});
// Track if we're already handling an error to prevent infinite loops
let isHandlingError = false;

process.on("unhandledRejection", async (err: Error | string) => {
  if (isHandlingError) {
    return; // Prevent recursive error handling
  }
  
  const error = err as Error;
  const errorMessage = error?.message || String(err);
  
  // Ignore known non-critical errors
  if (errorMessage.indexOf("could not coalesce") !== -1) {
    return;
  }
  
  isHandlingError = true;
  
  try {
    console.error("\n" + "=".repeat(60).red);
    console.error("⚠️  Unhandled Promise Rejection".red.bold);
    console.error("=".repeat(60).red);
    console.error("Error:", errorMessage.yellow);
    if (error?.stack) {
      console.error("\nStack trace:".dim);
      console.error(error.stack.split('\n').slice(0, 5).join('\n').dim);
    }
    console.error("\nThe CLI will attempt to continue...".green);
    console.error("=".repeat(60).red + "\n");
    
    // Give the user a moment to see the error
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (logError) {
    // If even logging fails, at least try to continue
    console.error("Critical error in error handler:", logError);
  } finally {
    isHandlingError = false;
  }
  
  // Don't exit - let the CLI continue
});

process.on("uncaughtException", (err: Error | string) => {
  if (isHandlingError) {
    // If we're already handling an error, exit to prevent infinite loop
    console.error("\nFatal: Multiple uncaught exceptions detected. Exiting...".red);
    process.exit(1);
    return;
  }
  
  const error = err as Error;
  const errorMessage = error?.message || String(err);
  
  // Ignore known non-critical errors
  if (errorMessage.indexOf("already held by process") !== -1) {
    return;
  }
  
  isHandlingError = true;
  
  try {
    console.error("\n" + "=".repeat(60).red);
    console.error("⚠️  Uncaught Exception".red.bold);
    console.error("=".repeat(60).red);
    console.error("Error:", errorMessage.yellow);
    if (error?.stack) {
      console.error("\nStack trace:".dim);
      console.error(error.stack.split('\n').slice(0, 10).join('\n').dim);
    }
    console.error("\nAttempting to recover...".green);
    console.error("=".repeat(60).red + "\n");
  } catch (logError) {
    // If logging fails, we must exit
    console.error("Fatal: Cannot log error. Exiting...");
    process.exit(1);
  }
  
  isHandlingError = false;
  
  // For uncaught exceptions, we'll try to continue but it's risky
  // The main loop should catch these and handle them gracefully
});

export const setConsoleTitle = (
  titleMessage = "TAMASHI - privacy llm",
) => {
  if (process.platform == "win32") {
    process.title = titleMessage;
  } else {
    process.stdout.write("\x1b]2;" + titleMessage + "\x1b\x5c");
  }
};

export const printLogo = () => {
  console.log(RAILGUN_HEADER);
};

export const resizeWindow = (width: number, heigth: number) => {
  process.stdout.write(`\u{033}[8;${heigth};${width}t`);
};
