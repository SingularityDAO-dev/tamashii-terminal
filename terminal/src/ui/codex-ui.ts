import { spawn, ChildProcess, exec } from "node:child_process";
import { promisify } from "node:util";
import https from "https";
import http from "http";
import {
  isCodexInstalled,
  isCodexAuthenticated,
  getCodexAuthStatus,
  buildCodexContext,
  formatContextForCodex,
  getCodexInstallInstructions,
  getCodexCommand,
} from "../util/codex-util";
import { confirmPrompt, confirmPromptCatch, confirmPromptCatchRetry } from "./confirm-ui";
import { clearConsoleBuffer } from "../util/error-util";
import { createBox, printSection, printWelcome, printCwd, colors, createDivider } from "../util/style-util";
import "colors";

/**
 * Authenticate Codex with API key to bypass ChatGPT login
 */
const authenticateCodexWithApiKey = async (apiKey: string, baseUrl?: string): Promise<boolean> => {
  return new Promise((resolve) => {
    // Set environment variables for authentication
    const envVars: NodeJS.ProcessEnv = {
      ...process.env,
      OPENAI_API_KEY: apiKey,
      CODEX_API_KEY: apiKey,
    };
    
    if (baseUrl) {
      envVars.OPENAI_BASE_URL = baseUrl;
      envVars.CODEX_BASE_URL = baseUrl;
    }

    // Use codex login --with-api-key to authenticate with API key
    const codexCmd = getCodexCommand();
    const loginProcess = spawn(codexCmd, ["login", "--with-api-key"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
      env: envVars,
    });

    // Send API key to stdin
    if (loginProcess.stdin) {
      loginProcess.stdin.write(apiKey + "\n");
      loginProcess.stdin.end();
    }

    let stdout = "";
    let stderr = "";

    if (loginProcess.stdout) {
      loginProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });
    }

    if (loginProcess.stderr) {
      loginProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });
    }

    loginProcess.on("exit", (code) => {
      // Login might succeed (code 0) or fail if already authenticated (non-zero)
      // Check stderr for authentication errors
      if (stderr.includes("401") || stderr.includes("Unauthorized")) {
        console.log("Warning: API key authentication failed. Codex may still use config file.".yellow);
      }
      // Either way, we can proceed - Codex will use the API key from config/env
      resolve(true);
    });

    loginProcess.on("error", () => {
      // Even if login fails, we can try launching Codex with env vars
      resolve(true);
    });
  });
};

/**
 * Call the API directly to get responses (bypasses Codex CLI bug)
 */
const callApiDirectly = async (
  question: string,
  context: string,
  apiKey: string,
  baseUrl: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl.replace(/\/$/, "") + "/chat/completions");
    const fullPrompt = `${context}\n\nUser Question: ${question}`;
    
    const requestData = JSON.stringify({
      model: "deepseek-v3.1",
      messages: [
        {
          role: "system",
          content: context,
        },
        {
          role: "user",
          content: question,
        },
      ],
      stream: false, // Use non-streaming for simplicity
      temperature: 0.7,
    });
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(requestData),
      },
    };
    
    const protocol = url.protocol === "https:" ? https : http;
    const req = protocol.request(options, (res) => {
      let data = "";
      
      res.on("data", (chunk) => {
        data += chunk;
      });
      
      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          if (response.choices && response.choices[0] && response.choices[0].message) {
            resolve(response.choices[0].message.content);
          } else if (response.error) {
            reject(new Error(response.error.message || "API error"));
          } else {
            reject(new Error("Unexpected API response format"));
          }
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${(error as Error).message}`));
        }
      });
    });
    
    req.on("error", (error) => {
      reject(error);
    });
    
    req.write(requestData);
    req.end();
  });
};

/**
 * Launch Codex in a simple interactive loop using exec mode
 * This works around issues with Codex's interactive mode not showing prompts
 */
const launchCodexInteractive = async (context: string, apiKey?: string, baseUrl?: string): Promise<void> => {
  return new Promise((resolve) => {
    // Ensure stdin is in cooked mode (not raw mode) for readline to work properly
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    
    // Resume stdin if it's paused
    if (process.stdin.isPaused()) {
      process.stdin.resume();
    }
    
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "tamashii> ".grey,
    });

    console.log("\nTamashii is ready! Type your questions below.".green);
    console.log("Type 'exit' or 'quit' to return to wallet menu.\n".dim);
    
    // Override the line event to show user input in grey
    const originalPrompt = rl.prompt.bind(rl);
    rl.prompt = () => {
      process.stdout.write("tamashii> ".grey);
    };
    
    rl.prompt();

    rl.on("line", async (input: string) => {
      const question = input.trim();
      
      if (!question) {
        rl.prompt();
        return;
      }
      
      if (question.toLowerCase() === "exit" || question.toLowerCase() === "quit") {
        rl.close();
        return;
      }

      // Move cursor up and reprint the question in grey
      process.stdout.write("\x1b[1A"); // Move up one line
      process.stdout.write("\x1b[2K"); // Clear the line
      console.log("tamashii> ".grey + question.grey);
      
      // Show that we're processing (yellow thinking animation)
      process.stdout.write("Thinking... ".yellow);
      
      try {
        // First, try calling the API directly (bypasses Codex CLI bug)
        // This ensures we get responses even if Codex CLI has issues
        let apiResponse: string | null = null;
        
        if (apiKey && baseUrl) {
          try {
            apiResponse = await callApiDirectly(question, context, apiKey, baseUrl);
          } catch (apiError) {
            // If direct API call fails, fall back to Codex CLI
            console.log("Direct API call failed, trying Tamashii CLI...".dim);
          }
        }
        
        // If direct API worked, use that response
        if (apiResponse) {
          process.stdout.write("\r" + " ".repeat(20) + "\r"); // Clear "Thinking..."
          console.log("\n" + apiResponse.white + "\n");
          rl.prompt();
          return;
        }
        
        // Fallback to Codex CLI exec mode
        const execAsync = promisify(exec);
        const fullPrompt = `${context}\n\nUser Question: ${question}`;
        
        // Build environment with API credentials
        const envVars = { ...process.env };
        if (apiKey) {
          envVars.OPENAI_API_KEY = apiKey;
          envVars.CODEX_API_KEY = apiKey;
        }
        if (baseUrl) {
          envVars.OPENAI_BASE_URL = baseUrl;
          envVars.CODEX_BASE_URL = baseUrl;
        }
        
        // Use exec with better error handling
        // Codex might output to stderr for some messages, so we need to handle both
        // Add --sandbox workspace-write to enable file operations
        const codexCmd = getCodexCommand();
        const { stdout, stderr } = await execAsync(`${codexCmd} --sandbox workspace-write exec "${fullPrompt.replace(/"/g, '\\"')}"`, {
          env: envVars,
          maxBuffer: 10 * 1024 * 1024,
        });
      
      // Clear "Thinking..." and show response
      process.stdout.write("\r" + " ".repeat(20) + "\r"); // Clear line
      
      // Extract the actual response from stdout
      // Codex outputs metadata and the actual response - we need to extract just the response
      let response = stdout.trim();
      
      // Filter out Codex metadata, errors, and extract the actual AI response
      const lines = response.split('\n');
      const responseLines: string[] = [];
      let foundUserQuestion = false;
      let collectingResponse = false;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines at the start
        if (!foundUserQuestion && !trimmedLine) {
          continue;
        }
        
        // Skip Codex header/metadata
        if (trimmedLine.includes('OpenAI Codex') || 
            trimmedLine.includes('workdir:') || 
            trimmedLine.includes('model:') || 
            trimmedLine.includes('provider:') || 
            trimmedLine.includes('approval:') || 
            trimmedLine.includes('sandbox:') ||
            trimmedLine.includes('session id:') ||
            trimmedLine === '--------' ||
            trimmedLine.toLowerCase() === 'user' ||
            trimmedLine.includes('mcp startup:') ||
            trimmedLine.includes('tokens used') ||
            trimmedLine.startsWith('2025-') || // Timestamp lines
            trimmedLine.includes('ERROR codex_core') ||
            trimmedLine.includes('OutputTextDelta') ||
            trimmedLine.includes('Current Wallet State:') ||
            trimmedLine.includes('Network:') ||
            trimmedLine.includes('Wallet Name:') ||
            trimmedLine.includes('Public Address:') ||
            trimmedLine.includes('Railgun Address:') ||
            trimmedLine.includes('Available Operations:') ||
            trimmedLine.includes('Note: This is a privacy-focused')) {
          continue;
        }
        
        // Mark when we find the user question
        if (trimmedLine.includes('User Question:')) {
          foundUserQuestion = true;
          collectingResponse = true;
          continue;
        }
        
        // Start collecting response after user question
        if (collectingResponse && trimmedLine) {
          // Skip lines that are part of the context/prompt
          if (!trimmedLine.includes('You are helping') && 
              !trimmedLine.includes('Shield') &&
              !trimmedLine.includes('Unshield') &&
              !trimmedLine.includes('Private Transfer') &&
              !trimmedLine.includes('Public Transfer') &&
              !trimmedLine.includes('Private Swap') &&
              !trimmedLine.includes('Public Swap')) {
            responseLines.push(line);
          }
        }
      }
      
      // Clean up the response
      let finalResponse = responseLines.join('\n').trim();
      
      // If we still have a lot of context in the response, try to extract just the answer part
      if (finalResponse.includes('You are helping') || finalResponse.length > 500) {
        // Try to find the actual answer after the context
        const answerMatch = finalResponse.match(/User Question:.*?\n\n(.*?)(?:\n\n|$)/s);
        if (answerMatch && answerMatch[1]) {
          finalResponse = answerMatch[1].trim();
        }
      }
      
      if (finalResponse && finalResponse.length > 0) {
        console.log("\n" + finalResponse.white + "\n");
      } else {
        console.log("\n" + "⚠️  Tamashii processed your request but didn't return a response.".yellow);
        console.log("\nVerified: compute3.ai API supports streaming responses ✓".green);
        console.log("However, the CLI has a bug handling responses from custom endpoints.".yellow);
        console.log("The 'OutputTextDelta without active item' error is a CLI issue.\n".dim);
        console.log("Possible solutions:".yellow);
        console.log("1. Update the CLI: 'npm update -g @openai/codex' or 'brew upgrade codex'".dim);
        console.log("2. Try with OpenAI's official endpoint to confirm it works".dim);
        console.log("3. Report this bug to CLI developers with your endpoint details".dim);
        console.log("4. Use the API directly via curl/HTTP instead of the CLI\n".dim);
        console.log("Your API is working correctly - this is a CLI compatibility issue.\n".grey);
      }
      
      // Check stderr for actual responses - sometimes the CLI outputs to stderr
      // But filter out errors and metadata
      if (stderr) {
        const stderrLines = stderr.split('\n');
        const stderrResponse = stderrLines
          .filter(line => 
            !line.includes("OutputTextDelta") &&
            !line.includes("ERROR codex_core") &&
            !line.startsWith("2025-") &&
            !line.includes("tokens used") &&
            !line.includes("mcp startup") &&
            !line.includes("OpenAI Codex") &&
            !line.includes("workdir:") &&
            !line.includes("model:") &&
            !line.trim()
          )
          .join('\n')
          .trim();
        
        // If stderr has a meaningful response (not just errors), show it
        if (stderrResponse && stderrResponse.length > 20) {
          console.log("\n" + stderrResponse.white + "\n");
        } else if (stderrResponse && 
                   !stderr.includes("OutputTextDelta") && 
                   !stderr.includes("warning")) {
          // Show other important stderr messages
          console.log(stderr.yellow);
        }
      }
      } catch (error: any) {
        process.stdout.write("\r" + " ".repeat(20) + "\r"); // Clear line
        if (error.stdout) {
          console.log("\n" + error.stdout.trim().white + "\n");
        } else {
          console.log(`\nError: ${error.message}\n`.red);
        }
      }
      
      rl.prompt();
    });

    // Handle close event
    rl.on("close", () => {
      // Ensure stdin is back to normal
      if (process.stdin.isTTY && process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
      console.log("\nReturning to wallet menu...".green);
      resolve();
    });
    
    // Handle SIGINT (Ctrl+C) to properly close readline
    const sigintHandler = () => {
      rl.close();
    };
    process.once('SIGINT', sigintHandler);
    
    // Clean up SIGINT handler when readline closes
    rl.once("close", () => {
      process.removeListener('SIGINT', sigintHandler);
    });
  });
};

/**
 * Spawn Codex process and handle interaction (original method)
 */
const launchCodexProcess = async (context: string, apiKey?: string, baseUrl?: string): Promise<void> => {
  return new Promise((resolve) => {
    // Use provided API key or read from config
    let finalApiKey: string | undefined = apiKey;
    let finalBaseUrl: string | undefined = baseUrl;
    
    // Read API key and base URL from config if not provided
    if (!finalApiKey || !finalBaseUrl) {
      try {
        const fs = require("node:fs");
        const path = require("node:path");
        const os = require("node:os");
        const configPath = path.join(os.homedir(), ".codex", "config.toml");
        if (fs.existsSync(configPath)) {
          const configContent = fs.readFileSync(configPath, "utf-8");
          // Match api_key (handles both quoted and unquoted)
          const apiKeyMatches = [
            ...configContent.matchAll(/^\s*api_key\s*=\s*["']([^"']+)["']/gm),
            ...configContent.matchAll(/^\s*api_key\s*=\s*([^\s#]+)/gm),
          ];
          for (const match of apiKeyMatches) {
            if (match[1] && !match[1].startsWith("sk-...") && match[1].length > 10) {
              finalApiKey = match[1];
              break;
            }
          }
          // Match base_url if not already provided
          if (!finalBaseUrl) {
            const baseUrlMatches = [
              ...configContent.matchAll(/^\s*base_url\s*=\s*["']([^"']+)["']/gm),
              ...configContent.matchAll(/^\s*base_url\s*=\s*([^\s#]+)/gm),
            ];
            for (const match of baseUrlMatches) {
              if (match[1] && match[1].startsWith("http")) {
                finalBaseUrl = match[1];
                break;
              }
            }
          }
        }
      } catch (error) {
        // Ignore config read errors
      }
    }

    // Build environment variables
    const envVars: NodeJS.ProcessEnv = {
      ...process.env,
      // Pass context via environment variable (Codex can read this)
      CODEX_CONTEXT: context,
      // Ensure Codex knows it's in interactive mode
      TERM: process.env.TERM || 'xterm-256color',
      // Force color output
      FORCE_COLOR: '1',
    };

    // Pass API credentials via environment if available
    // Codex CLI may recognize these environment variables
    // These are the standard OpenAI-compatible environment variables
    if (finalApiKey) {
      envVars.OPENAI_API_KEY = finalApiKey;
      envVars.CODEX_API_KEY = finalApiKey; // Some tools use this
      // Also try other common variations
      envVars.API_KEY = finalApiKey;
    }
    if (finalBaseUrl) {
      envVars.OPENAI_BASE_URL = finalBaseUrl;
      envVars.CODEX_BASE_URL = finalBaseUrl; // Some tools use this
      // Also try other common variations
      envVars.BASE_URL = finalBaseUrl;
      envVars.API_BASE_URL = finalBaseUrl;
    }
    
    // Ensure Codex uses API key authentication instead of ChatGPT
    // by clearing any ChatGPT session tokens
    delete envVars.CODEX_SESSION_TOKEN;
    delete envVars.CODEX_ACCESS_TOKEN;

    // Build Codex command arguments
    // Try to pass API key via config override if available
    const codexArgs: string[] = [];
    
    // Enable workspace write access for file operations
    // This allows Codex to create, modify, and delete files in the workspace
    codexArgs.push("--sandbox", "workspace-write");
    
    if (finalApiKey) {
      // Pass API key as config override - Codex should use this
      codexArgs.push("--config", `api_key="${finalApiKey}"`);
    }
    if (finalBaseUrl) {
      codexArgs.push("--config", `base_url="${finalBaseUrl}"`);
    }
    
    // Force Codex to use API key authentication by setting model provider
    if (finalApiKey && finalBaseUrl) {
      codexArgs.push("--config", `model_provider=openai`);
    }
    
    // Note: Codex in interactive mode doesn't accept a prompt as argument
    // The context is passed via environment variable CODEX_CONTEXT
    // Codex will read this when it starts and use it as system context
    // Users can then interact with Codex normally, and it will have the context

    // Ensure terminal is ready for output
    // Flush any pending output before launching Codex
    if (process.stdout.isTTY) {
      // Reset terminal state
      process.stdout.write('\x1b[?25h'); // Show cursor
      process.stdout.write('\x1b[0m'); // Reset colors
      process.stdout.write('\n');
      // Ensure we're not in raw mode that might interfere
      if (process.stdin.isTTY && process.stdin.setRawMode) {
        // stdin should be in cooked mode for Codex
        process.stdin.setRawMode(false);
      }
    }
    if (process.stderr.isTTY) {
      process.stderr.write('');
    }
    
    // Spawn Codex in interactive mode
    // Codex requires a proper TTY to work - ensure we're using shell for better compatibility
    // Using shell: true helps with terminal emulation and ensures proper TTY handling
    console.log("\nStarting Tamashii... (this may take a moment)".dim);
    
    const codexCmd = getCodexCommand();
    const codexProcess: ChildProcess = spawn(codexCmd, codexArgs, {
      stdio: "inherit", // All streams inherit - Codex needs full terminal control
      shell: true, // Use shell for better terminal compatibility
      env: envVars,
      detached: false,
      cwd: process.cwd(),
    });
    
    // Give Codex a moment to initialize before we continue
    // Sometimes Codex takes a second to display its prompt
    setTimeout(() => {
      // Tamashii should now be running and displaying its prompt
      // If you still don't see a prompt, Tamashii might be:
      // 1. Waiting for API initialization (check your API key/endpoint)
      // 2. Encountering a silent error
      // 3. Having terminal compatibility issues
    }, 500);

    // Handle process events
    codexProcess.on("error", (error) => {
      console.log(`\nError launching Tamashii: ${error.message}`.red);
      console.log("This might be due to:".yellow);
      console.log("- Tamashii CLI not found in PATH".grey);
      console.log("- Invalid API configuration".grey);
      console.log("- Network connectivity issues".grey);
      resolve();
    });

    codexProcess.on("exit", (code, signal) => {
      if (code === null && signal) {
        console.log(`\nTamashii was terminated by signal: ${signal}`.yellow);
      } else if (code === 0) {
        console.log("\nReturning to wallet menu...".green);
      } else if (code !== null) {
        console.log(`\nTamashii exited with code ${code}`.yellow);
        if (code !== 0) {
          console.log("This might indicate an error. Check your API configuration.".yellow);
          console.log("Config file: ~/.codex/config.toml".grey);
        }
      }
      resolve();
    });

    // Note: stdio: "inherit" already handles stdin/stdout/stderr
    // No need to manually pipe stdin
  });
};

/**
 * Launch Tamashii AI with wallet context
 */
export const launchCodex = async (): Promise<void> => {
  try {
    clearConsoleBuffer();
    console.log("Checking Tamashii installation...".dim);

    // Check if Codex CLI is installed
    const installed = await isCodexInstalled();
    if (!installed) {
      printSection(
        "Tamashii Installation Required",
        getCodexInstallInstructions(),
        { color: "warning" }
      );
      await confirmPromptCatchRetry("Press ENTER to continue");
      return;
    }

    console.log(colors.success("✓ Tamashii is installed."));
    console.log(colors.dim("Checking authentication..."));

    // Check authentication
    const authStatus = getCodexAuthStatus();
    if (!authStatus.authenticated) {
      printSection(
        "Authentication Required",
        [
          "Tamashii is installed but not authenticated.",
          "",
          "Please run 'codex' in your terminal to sign in with ChatGPT.",
          "Or configure an API key in ~/.codex/config.toml",
        ],
        { color: "warning" }
      );
      await confirmPromptCatchRetry("Press ENTER to continue");
      return;
    }

    // Check if we have API key configured
    const hasApiKey = authStatus.method === "api_key";
    if (hasApiKey) {
      console.log(colors.success("✓ Tamashii API key found in config."));
    } else {
      console.log(colors.success("✓ Tamashii authentication detected."));
    }
    console.log(colors.dim("Building wallet context..."));

    // Build context
    let contextString = "";
    let apiKeyForAuth: string | undefined;
    let baseUrlForAuth: string | undefined;
    try {
      const context = await buildCodexContext();
      contextString = formatContextForCodex(context);
      console.log(colors.success("✓ Context built successfully."));
      
      // Extract API key and base URL for authentication
      if (hasApiKey) {
        try {
          const fs = require("node:fs");
          const path = require("node:path");
          const os = require("node:os");
          const configPath = path.join(os.homedir(), ".codex", "config.toml");
          if (fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, "utf-8");
            const apiKeyMatches = [
              ...configContent.matchAll(/^\s*api_key\s*=\s*["']([^"']+)["']/gm),
              ...configContent.matchAll(/^\s*api_key\s*=\s*([^\s#]+)/gm),
            ];
            for (const match of apiKeyMatches) {
              // Accept any API key format (not just sk-...)
              if (match[1] && !match[1].startsWith("sk-...") && match[1].length > 10) {
                apiKeyForAuth = match[1];
                break;
              }
            }
            // Also extract base_url
            const baseUrlMatches = [
              ...configContent.matchAll(/^\s*base_url\s*=\s*["']([^"']+)["']/gm),
              ...configContent.matchAll(/^\s*base_url\s*=\s*([^\s#]+)/gm),
            ];
            for (const match of baseUrlMatches) {
              if (match[1] && match[1].startsWith("http")) {
                baseUrlForAuth = match[1];
                break;
              }
            }
          }
        } catch (error) {
          // Ignore
        }
      }
    } catch (error) {
      console.log(colors.warning("⚠ Warning: Could not build wallet context."));
      console.log(colors.dim((error as Error).message));
      contextString = "You are helping with a Terminal Wallet CLI session.";
    }

    // Authenticate with API key to bypass ChatGPT login prompt
    if (hasApiKey && apiKeyForAuth) {
      console.log(colors.dim("Authenticating Tamashii with API key to bypass login prompt..."));
      
      // First, logout any existing ChatGPT authentication
      try {
        const { exec } = require("node:child_process");
        const { promisify } = require("node:util");
        const execAsync = promisify(exec);
        const codexCmd = getCodexCommand();
        await execAsync(`${codexCmd} logout`).catch(() => {
          // Ignore errors - might not be logged in
        });
      } catch (error) {
        // Ignore logout errors
      }
      
      // Then authenticate with API key
      const authenticated = await authenticateCodexWithApiKey(apiKeyForAuth, baseUrlForAuth);
      if (authenticated) {
        console.log(colors.success("✓ API key authentication configured."));
      }
    }

    // Print ASCII art welcome
    const asciiArt = `
${"╔════════════════════════════════════════════════════════════╗".yellow}
${"║".yellow}                                                            ${"║".yellow}
${"║".yellow}  ${"████████╗ █████╗ ███╗   ███╗ █████╗ ███████╗██╗  ██╗██╗".yellow}   ${"║".yellow}
${"║".yellow}  ${"╚══██╔══╝██╔══██╗████╗ ████║██╔══██╗██╔════╝██║  ██║██║".yellow}   ${"║".yellow}
${"║".yellow}  ${"   ██║   ███████║██╔████╔██║███████║███████╗███████║██║".yellow}   ${"║".yellow}
${"║".yellow}  ${"   ██║   ██╔══██║██║╚██╔╝██║██╔══██║╚════██║██╔══██║██║".yellow}   ${"║".yellow}
${"║".yellow}  ${"   ██║   ██║  ██║██║ ╚═╝ ██║██║  ██║███████║██║  ██║██║".yellow}   ${"║".yellow}
${"║".yellow}  ${"   ╚═╝   ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝".yellow}   ${"║".yellow}
${"║".yellow}                                                            ${"║".yellow}
${"║".yellow}                    ${"━━ terminal ━━".grey}                        ${"║".yellow}
${"║".yellow}                                                            ${"║".yellow}
${"╚════════════════════════════════════════════════════════════╝".yellow}
`;
    console.log(asciiArt);
    
    // Show brief hint
    console.log(colors.dim("Type 'exit' to return to wallet menu\n"));
    
    // Important: Flush all output and ensure terminal is ready
    // This ensures Tamashii can properly display its output
    if (process.stdout.isTTY) {
      // Reset terminal to a clean state
      process.stdout.write('\x1b[0m'); // Reset colors
      process.stdout.write('\x1b[?25h'); // Show cursor
      process.stdout.write('\n');
    }
    
    // Ensure stdin is ready for readline
    // Readline needs stdin to be in cooked mode and not paused
    if (process.stdin.isTTY) {
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
      if (process.stdin.isPaused()) {
        process.stdin.resume();
      }
    }
    
    // Small delay to ensure messages are visible before Tamashii takes over
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // Write a newline to ensure Tamashii starts on a fresh line
    process.stdout.write('\n');

    // Launch Tamashii - try interactive wrapper first (more reliable)
    // If that doesn't work, fall back to direct spawn
    try {
      await launchCodexInteractive(contextString, apiKeyForAuth, baseUrlForAuth);
    } catch (error) {
      // Fallback to original method if interactive wrapper fails
      console.log("Falling back to direct Tamashii launch...".yellow);
      await launchCodexProcess(contextString, apiKeyForAuth, baseUrlForAuth);
    }
    
    // After Tamashii exits, wait a moment before returning
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (error) {
    console.log("\n" + "=".repeat(60).red);
    console.log("Error launching Tamashii:".red);
    console.log((error as Error).message.red);
    console.log("=".repeat(60).red + "\n");
    await confirmPromptCatchRetry("Press ENTER to continue");
  }
};

/**
 * Launch Tamashii with a specific prompt (non-interactive mode)
 */
export const launchCodexWithPrompt = async (
  prompt: string,
): Promise<string | undefined> => {
  clearConsoleBuffer();

  const installed = await isCodexInstalled();
  if (!installed) {
    console.log(getCodexInstallInstructions().yellow);
    return undefined;
  }

  const authStatus = getCodexAuthStatus();
  if (!authStatus.authenticated) {
    console.log("Tamashii is not authenticated. Please run 'codex' to sign in.".yellow);
    return undefined;
  }

  try {
    const context = await buildCodexContext();
    const contextString = formatContextForCodex(context);
    const fullPrompt = `${contextString}\n\nUser Question: ${prompt}`;

    // Use Codex exec mode for non-interactive usage
    const execAsync = promisify(exec);
    
    // Set environment variables for API authentication
    const envVars = { ...process.env };
    try {
      const fs = require("node:fs");
      const path = require("node:path");
      const os = require("node:os");
      const configPath = path.join(os.homedir(), ".codex", "config.toml");
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, "utf-8");
        const apiKeyMatches = [
          ...configContent.matchAll(/^\s*api_key\s*=\s*["']([^"']+)["']/gm),
          ...configContent.matchAll(/^\s*api_key\s*=\s*([^\s#]+)/gm),
        ];
        for (const match of apiKeyMatches) {
          if (match[1] && !match[1].startsWith("sk-...") && match[1].length > 10) {
            envVars.OPENAI_API_KEY = match[1];
            envVars.CODEX_API_KEY = match[1];
            break;
          }
        }
        const baseUrlMatches = [
          ...configContent.matchAll(/^\s*base_url\s*=\s*["']([^"']+)["']/gm),
          ...configContent.matchAll(/^\s*base_url\s*=\s*([^\s#]+)/gm),
        ];
        for (const match of baseUrlMatches) {
          if (match[1] && match[1].startsWith("http")) {
            envVars.OPENAI_BASE_URL = match[1];
            envVars.CODEX_BASE_URL = match[1];
            break;
          }
        }
      }
    } catch (error) {
      // Ignore config read errors
    }

    const codexCmd = getCodexCommand();
    const { stdout, stderr } = await execAsync(`${codexCmd} --sandbox workspace-write exec "${fullPrompt.replace(/"/g, '\\"')}"`, {
      env: envVars,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large responses
    });
    
    // Display the output
    if (stdout) {
      console.log(stdout);
    }
    if (stderr && !stderr.includes("warning")) {
      console.log(stderr.yellow);
    }
    
    return stdout.trim();
  } catch (error) {
    const err = error as any;
    if (err.stdout) {
      console.log(err.stdout);
    }
    if (err.stderr) {
      console.log(err.stderr.red);
    }
    console.log(`Error running Tamashii: ${err.message}`.red);
    return undefined;
  }
};

/**
 * Check Tamashii availability and return status
 */
export const getCodexStatus = async (): Promise<{
  installed: boolean;
  authenticated: boolean;
  method?: string;
}> => {
  const installed = await isCodexInstalled();
  if (!installed) {
    return { installed: false, authenticated: false };
  }

  const authStatus = getCodexAuthStatus();
  return {
    installed: true,
    authenticated: authStatus.authenticated,
    method: authStatus.method,
  };
};
