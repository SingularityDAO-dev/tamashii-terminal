/**
 * Tamashii Backend API Client
 */
import https from "https";
import http from "http";

const TAMASHII_API_URL = "https://tamashii.compute3.ai/api";

// Store JWT in memory
let currentJwt: string | null = null;
let currentAddress: string | null = null;

export const setJwt = (jwt: string, address: string) => {
  currentJwt = jwt;
  currentAddress = address;
};

export const clearJwt = () => {
  currentJwt = null;
  currentAddress = null;
};

export const getJwt = () => currentJwt;
export const getAddress = () => currentAddress;
export const isAuthenticated = () => currentJwt !== null && currentJwt !== "";

/**
 * Make HTTP request to Tamashii API
 */
const apiRequest = async <T>(
  method: string,
  path: string,
  body?: any,
  auth = true
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const url = new URL(TAMASHII_API_URL + path);
    const isHttps = url.protocol === "https:";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (auth && currentJwt) {
      headers["Authorization"] = `Bearer ${currentJwt}`;
    }

    const requestData = body ? JSON.stringify(body) : undefined;
    if (requestData) {
      headers["Content-Length"] = Buffer.byteLength(requestData).toString();
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method,
      headers,
    };

    const protocol = isHttps ? https : http;
    const req = protocol.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`API error ${res.statusCode}: ${data}`));
            return;
          }
          resolve(JSON.parse(data) as T);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on("error", reject);
    if (requestData) req.write(requestData);
    req.end();
  });
};

/**
 * Get deposit address (unauthenticated)
 */
export const getDepositAddress = async (): Promise<{
  evmAddress: string;
  railgunAddress: string;
}> => {
  return apiRequest("GET", "/address", undefined, false);
};

/**
 * Authenticate with signed message
 */
export const authenticate = async (
  message: string,
  signature: string,
  address: string
): Promise<{ token: string; address: string }> => {
  const result = await apiRequest<{ token: string; address: string }>(
    "POST",
    "/auth/verify",
    { message, signature, address },
    false
  );
  setJwt(result.token, result.address);
  return result;
};

/**
 * Get balance
 */
export const getBalance = async (): Promise<{
  address: string;
  deposits_bnb: number;
  spent_bnb: number;
  balance_bnb: number;
  balance_usd: number;
}> => {
  if (!currentJwt) throw new Error("Not authenticated");
  return apiRequest("GET", "/balance");
};

/**
 * Launch GPU job
 */
export interface LaunchJobRequest {
  gpu_type: string;
  image: string;
  duration_seconds: number;
  region?: string;
  command?: string;
  env?: Record<string, string>;
  ports?: Record<string, number>;
  auth?: boolean;
}

export interface LaunchJobResponse {
  id: string;
  c3_job_id: string;
  gpu_type: string;
  duration_seconds: number;
  cost_usd: number;
  cost_bnb: number;
  hostname: string | null;
}

export const launchJob = async (req: LaunchJobRequest): Promise<LaunchJobResponse> => {
  if (!currentJwt) throw new Error("Not authenticated");
  return apiRequest("POST", "/jobs", req);
};

/**
 * List jobs
 */
export interface Job {
  id: string;
  c3_job_id: string;
  gpu_type: string;
  cost_bnb: number;
  created_at: string;
}

export const listJobs = async (): Promise<Job[]> => {
  if (!currentJwt) throw new Error("Not authenticated");
  return apiRequest("GET", "/jobs");
};

/**
 * Get job details
 */
export const getJob = async (jobId: string): Promise<Job> => {
  if (!currentJwt) throw new Error("Not authenticated");
  return apiRequest("GET", `/jobs/${jobId}`);
};
