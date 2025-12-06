import { exec } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { NetworkName } from "@railgun-community/shared-models";
import {
  getCurrentRailgunAddress,
  getCurrentRailgunID,
  getCurrentWalletName,
  getCurrentWalletPublicAddress,
} from "../wallet/wallet-util";
import { getCurrentNetwork } from "../engine/engine";
import { getChainForName, remoteConfig } from "../network/network-util";
import configDefaults from "../config/config-defaults";
import { cwd } from "node:process";

const execAsync = promisify(exec);

const CODEX_CONFIG_PATH = join(homedir(), ".codex", "config.toml");

export interface CodexContext {
  network: NetworkName;
  networkName: string;
  chainId: number;
  publicAddress: string;
  railgunAddress: string;
  walletName: string;
  networkCapabilities: {
    canShield: boolean;
    canUnshield: boolean;
    canSendShielded: boolean;
    canSendPublic: boolean;
    canSwapShielded: boolean;
    canSwapPublic: boolean;
    canRelayAdapt: boolean;
  };
  fileSystemCapabilities: {
    canRead: boolean;
    canWrite: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    workspacePath: string;
    availableDirectories: string[];
  };
}

/**
 * Get the codex command - uses npx to find local installation
 */
export const getCodexCommand = (): string => {
  return "npx --yes @openai/codex";
};

/**
 * Check if Codex CLI is installed and available
 */
export const isCodexInstalled = async (): Promise<boolean> => {
  try {
    const { stdout } = await execAsync(`${getCodexCommand()} --version`);
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
};

/**
 * Check if Codex is authenticated by checking for config file
 */
export const isCodexAuthenticated = (): boolean => {
  return existsSync(CODEX_CONFIG_PATH);
};

/**
 * Get Codex authentication status from config file
 */
export const getCodexAuthStatus = (): { authenticated: boolean; method?: string } => {
  // Check if config file exists
  if (!isCodexAuthenticated()) {
    return { authenticated: false };
  }

  try {
    const configContent = readFileSync(CODEX_CONFIG_PATH, "utf-8");
    
    // Check for API key in config (uncommented)
    const apiKeyMatch = configContent.match(/^\s*api_key\s*=\s*["']([^"']+)["']/m);
    if (apiKeyMatch && apiKeyMatch[1] && !apiKeyMatch[1].startsWith("sk-...")) {
      return { authenticated: true, method: "api_key" };
    }
    
    // Check for other auth indicators
    if (configContent.includes("api_key") && !configContent.includes("# api_key")) {
      return { authenticated: true, method: "api_key" };
    }
    
    // If config exists, Codex might be authenticated via ChatGPT login
    // (which stores tokens separately, not in config.toml)
    // We'll assume authenticated if config exists and try to launch
    // The actual check will happen when Codex tries to run
    return { authenticated: true, method: "chatgpt" };
  } catch (error) {
    return { authenticated: false };
  }
};

/**
 * Build wallet context for Codex
 */
export const buildCodexContext = async (): Promise<CodexContext> => {
  const network = getCurrentNetwork();
  const chain = getChainForName(network);
  const networkConfig = remoteConfig?.network?.[chain.id];
  const networkName = configDefaults.networkConfig[network].name;
  const workspacePath = cwd();

  return {
    network,
    networkName,
    chainId: chain.id,
    publicAddress: getCurrentWalletPublicAddress(),
    railgunAddress: getCurrentRailgunAddress(),
    walletName: getCurrentWalletName(),
    networkCapabilities: {
      canShield: networkConfig?.flags?.canShield ?? false,
      canUnshield: networkConfig?.flags?.canUnshield ?? false,
      canSendShielded: networkConfig?.flags?.canSendShielded ?? false,
      canSendPublic: networkConfig?.flags?.canSendPublic ?? false,
      canSwapShielded: networkConfig?.flags?.canSwapShielded ?? false,
      canSwapPublic: networkConfig?.flags?.canSwapPublic ?? false,
      canRelayAdapt: networkConfig?.flags?.canRelayAdapt ?? false,
    },
    fileSystemCapabilities: {
      canRead: true,
      canWrite: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      workspacePath,
      availableDirectories: [
        workspacePath,
        join(workspacePath, "src"),
        join(workspacePath, ".zKeyChains"),
        join(workspacePath, ".wallets"),
        "/tmp",
        process.env.TMPDIR || "/tmp",
      ],
    },
  };
};

/**
 * Format context as a string for Codex prompt
 */
export const formatContextForCodex = (context: CodexContext): string => {
  const capabilities = context.networkCapabilities;
  const fsCapabilities = context.fileSystemCapabilities;
  const availableOps = [];

  if (capabilities.canShield) availableOps.push("Shield");
  if (capabilities.canUnshield) availableOps.push("Unshield");
  if (capabilities.canSendShielded) availableOps.push("Private Transfer");
  if (capabilities.canSendPublic) availableOps.push("Public Transfer");
  if (capabilities.canSwapShielded) availableOps.push("Private Swap");
  if (capabilities.canSwapPublic) availableOps.push("Public Swap");

  return `You are helping with a Terminal Wallet CLI session.

Current Wallet State:
- Network: ${context.networkName} (Chain ID: ${context.chainId})
- Wallet Name: ${context.walletName}
- Public Address: ${context.publicAddress}
- Railgun Address: ${context.railgunAddress}

Available Operations on ${context.networkName}:
${availableOps.length > 0 ? availableOps.map(op => `- ${op}`).join("\n") : "- None available"}

File System Capabilities:
You have full read, write, create, update, and delete access to files and directories.
- Workspace Path: ${fsCapabilities.workspacePath}
- Available Directories:
${fsCapabilities.availableDirectories.map(dir => `  - ${dir}`).join("\n")}

You can:
- Create new files and folders
- Read existing files
- Update/modify files
- Delete files and folders
- Navigate the file system
- Work with code files, configuration files, and data files

Note: This is a privacy-focused wallet using Railgun for private transactions.
Do not expose sensitive information like passwords or mnemonics.
When working with files, be careful not to modify critical wallet files in .zKeyChains or .wallets directories unless explicitly requested.`;
};

/**
 * Get installation instructions for Tamashii (Codex CLI)
 */
export const getCodexInstallInstructions = (): string => {
  return `Tamashii AI is powered by Codex CLI (included as a project dependency).

If you're seeing this message, Codex may need to be initialized.
Run: npm install  (or yarn install) to ensure dependencies are installed.

Codex will be automatically run via npx when you use Privacy AI.

After installation, authenticate with your API key in ~/.codex/config.toml,
or configure an API key in ~/.codex/config.toml for Tamashii.`;
};

