/**
 * GPU Job Management for Tamashii
 */
import * as api from "./api";

// Store active GPU session
let activeSession: {
  jobId: string;
  c3JobId: string;
  hostname: string;
  apiKey: string;
  model: string;
} | null = null;

export const getActiveSession = () => activeSession;
export const clearActiveSession = () => { activeSession = null; };

/**
 * Generate random API key for vLLM instance
 */
const generateApiKey = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "tamashii_instance_";
  for (let i = 0; i < 24; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
};

/**
 * Launch a vLLM GPU instance
 */
export const launchVllm = async (options: {
  model?: string;
  gpuType?: string;
  duration?: number;
  region?: string;
}): Promise<{
  jobId: string;
  c3JobId: string;
  apiKey: string;
  costBnb: number;
  costUsd: number;
}> => {
  const apiKey = generateApiKey();
  const model = options.model || "NousResearch/Hermes-3-Llama-3.2-3B";
  const servedName = model.includes("Hermes") ? "hermes3:3b" : model.split("/").pop() || "llm";

  const result = await api.launchJob({
    gpu_type: options.gpuType || "l4",
    image: "ghcr.io/compute3ai/images/c3-vllm",
    duration_seconds: options.duration || 600,
    region: options.region || "kr",
    env: {
      MODEL_NAME: model,
      SERVED_MODEL_NAME: servedName,
      MAX_MODEL_LEN: "8192",
      GPU_MEMORY_UTILIZATION: "0.90",
      API_KEY: apiKey,
    },
    ports: { lb: 8000 },
  });

  return {
    jobId: result.id,
    c3JobId: result.c3_job_id,
    apiKey,
    costBnb: result.cost_bnb,
    costUsd: result.cost_usd,
  };
};

/**
 * Poll C3 API for job hostname
 * Note: This requires C3 SDK or direct API call - for now we'll use a simple HTTP check
 */
export const waitForHostname = async (
  c3JobId: string,
  apiKey: string,
  onProgress?: (msg: string) => void,
  timeoutMs = 120000
): Promise<string> => {
  const startTime = Date.now();

  // For now, poll the vLLM health endpoint on various hostnames
  // In production, this would query C3 API directly
  // The hostname format is: <random>-gpu.compute3.ai

  onProgress?.("Waiting for GPU to start...");

  // Poll every 5 seconds
  while (Date.now() - startTime < timeoutMs) {
    onProgress?.(`Waiting for GPU... (${Math.round((Date.now() - startTime) / 1000)}s)`);
    await new Promise(r => setTimeout(r, 5000));

    // TODO: Query C3 API for job status and hostname
    // For now, we'll need to get this from somewhere else
  }

  throw new Error("Timeout waiting for GPU to start");
};

/**
 * Check if vLLM instance is ready
 */
export const checkVllmHealth = async (hostname: string, apiKey: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const https = require("https");
    const req = https.request(
      {
        hostname,
        path: "/v1/models",
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 5000,
      },
      (res: any) => {
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end();
  });
};

/**
 * Set active session after vLLM is ready
 */
export const setActiveSession = (session: {
  jobId: string;
  c3JobId: string;
  hostname: string;
  apiKey: string;
  model: string;
}) => {
  activeSession = session;
};

/**
 * Get vLLM endpoint URL for active session
 */
export const getVllmEndpoint = (): string | null => {
  if (!activeSession) return null;
  return `https://${activeSession.hostname}`;
};

/**
 * Get vLLM API key for active session
 */
export const getVllmApiKey = (): string | null => {
  if (!activeSession) return null;
  return activeSession.apiKey;
};
