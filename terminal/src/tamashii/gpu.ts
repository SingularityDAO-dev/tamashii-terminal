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

/**
 * Get GPU status (logs + metrics) for active session
 */
export const getGpuStatus = async (): Promise<{
  logs: string | null;
  metrics: api.JobMetrics | null;
  error?: string;
}> => {
  if (!activeSession) {
    return { logs: null, metrics: null, error: "No active GPU session" };
  }

  let logs: string | null = null;
  let metrics: api.JobMetrics | null = null;
  let error: string | undefined;

  // Fetch logs (best effort)
  try {
    const logsResult = await api.getJobLogs(activeSession.jobId);
    logs = logsResult.logs;
  } catch (e) {
    // Ignore - logs might not be available
  }

  // Fetch metrics (best effort)
  try {
    metrics = await api.getJobMetrics(activeSession.jobId);
  } catch (e) {
    // Ignore - metrics might not be available (job still starting)
  }

  return { logs, metrics, error };
};

/**
 * Chat with vLLM instance
 */
export const chatWithVllm = async (
  message: string,
  onToken?: (token: string) => void
): Promise<string> => {
  if (!activeSession) {
    throw new Error("No active GPU session");
  }

  const session = activeSession; // TypeScript narrowing
  const https = require("https");

  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: session.model,
      messages: [{ role: "user", content: message }],
      stream: true,
    });

    const req = https.request(
      {
        hostname: session.hostname,
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.apiKey}`,
          "Content-Length": Buffer.byteLength(requestBody),
        },
      },
      (res: any) => {
        if (res.statusCode !== 200) {
          let errorData = "";
          res.on("data", (chunk: Buffer) => { errorData += chunk.toString(); });
          res.on("end", () => reject(new Error(`API error ${res.statusCode}: ${errorData}`)));
          return;
        }

        let fullResponse = "";
        let buffer = "";

        res.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                  onToken?.(content);
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        });

        res.on("end", () => resolve(fullResponse));
      }
    );

    req.on("error", reject);
    req.write(requestBody);
    req.end();
  });
};
