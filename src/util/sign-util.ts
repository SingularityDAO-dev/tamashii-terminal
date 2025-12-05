import { signWithWalletViewingKey } from "@railgun-community/wallet";
import { getCurrentRailgunID, getCurrentRailgunAddress } from "../wallet/wallet-util";

/**
 * Sign a message with the wallet's viewing key
 */
export const signMessage = async (
  message: string
): Promise<{ message: string; signature: string; address: string }> => {
  const walletId = getCurrentRailgunID();
  const address = getCurrentRailgunAddress();
  
  if (!walletId || !address) {
    throw new Error("Wallet not initialized");
  }
  
  // Convert message to hex
  const messageHex = Buffer.from(message).toString("hex");
  const signature = await signWithWalletViewingKey(walletId, messageHex);
  
  return {
    message,
    signature,
    address,
  };
};

/**
 * Sign a timestamp for authentication
 */
export const signTimestamp = async (): Promise<{
  timestamp: number;
  message: string;
  signature: string;
  address: string;
}> => {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `Welcome to TAMASHI ${timestamp}`;
  const result = await signMessage(message);
  
  return {
    timestamp,
    message: result.message,
    signature: result.signature,
    address: result.address,
  };
};

/**
 * Generate authentication payload for Tamashi Network
 */
export const generateAuthPayload = async (): Promise<{
  timestamp: number;
  message: string;
  signature: string;
  address: string;
  payload: string;
}> => {
  const signedData = await signTimestamp();
  
  // Create a JSON payload that can be sent to the network
  const payload = JSON.stringify({
    message: signedData.message,
    signature: signedData.signature,
    address: signedData.address,
  });
  
  return {
    ...signedData,
    payload,
  };
};

