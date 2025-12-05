import { baseAllowList, baseBlockList, isWakuLoaded, wakuClient } from "./connect-waku";
import * as fs from "fs";
import * as path from "path";

let currentAllowList: Optional<string[]> = [];
let currentBlockList: Optional<string[]> = [];
let customBroadcasters: string[] = [];

// Path to store custom broadcaster config
const BROADCASTER_CONFIG_PATH = path.join(process.cwd(), ".broadcasters.json");

// Load custom broadcasters from file
export const loadCustomBroadcasters = (): string[] => {
  try {
    if (fs.existsSync(BROADCASTER_CONFIG_PATH)) {
      const data = fs.readFileSync(BROADCASTER_CONFIG_PATH, "utf-8");
      const config = JSON.parse(data);
      customBroadcasters = config.broadcasters || [];
      console.log(`Loaded ${customBroadcasters.length} custom broadcaster(s)`.grey);
      return customBroadcasters;
    }
  } catch (err) {
    console.warn("Could not load custom broadcasters:", (err as Error)?.message);
  }
  return [];
};

// Save custom broadcasters to file
export const saveCustomBroadcasters = (): void => {
  try {
    const config = { broadcasters: customBroadcasters };
    fs.writeFileSync(BROADCASTER_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    console.warn("Could not save custom broadcasters:", (err as Error)?.message);
  }
};

// Add a custom broadcaster (persists to file)
export const addCustomBroadcaster = (broadcasterAddress: string): void => {
  if (!broadcasterAddress.startsWith("0zk")) {
    throw new Error("Broadcaster address must be a Railgun address (starts with 0zk)");
  }
  
  // Add to custom list if not already present
  if (!customBroadcasters.includes(broadcasterAddress)) {
    customBroadcasters.push(broadcasterAddress);
    saveCustomBroadcasters();
    console.log(`✅ Added custom broadcaster: ${broadcasterAddress.slice(0, 15)}...`.green);
  }
  
  // Add to active allowlist
  addChosenBroadcaster(broadcasterAddress);
};

// Remove a custom broadcaster
export const removeCustomBroadcaster = (broadcasterAddress: string): void => {
  customBroadcasters = customBroadcasters.filter(b => b !== broadcasterAddress);
  saveCustomBroadcasters();
  console.log(`Removed custom broadcaster: ${broadcasterAddress.slice(0, 15)}...`.yellow);
};

// Get all custom broadcasters
export const getCustomBroadcasters = (): string[] => {
  return [...customBroadcasters];
};

// Apply custom broadcasters to the allowlist
export const applyCustomBroadcasters = (): void => {
  if (!isWakuLoaded() || !wakuClient) {
    return;
  }
  
  // Load custom broadcasters
  loadCustomBroadcasters();
  
  // Add them to the allowlist
  for (const broadcaster of customBroadcasters) {
    addChosenBroadcaster(broadcaster);
  }
};

export const addRemovedBroadcaster = (broadcasterAddress: string) => {
  if (!isWakuLoaded()) {
    throw new Error("Waku Client is not Loaded");
  }
  if (!wakuClient) {
    return;
  }
  if (!currentBlockList) {
    currentBlockList = baseBlockList;
  }
  currentBlockList?.push(broadcasterAddress);
  wakuClient.setAddressFilters(undefined, currentBlockList);
};

export const addChosenBroadcaster = (broadcasterAddress: string) => {
  if (!isWakuLoaded()) {
    throw new Error("Waku Client is not Loaded");
  }
  if (!wakuClient) {
    return;
  }
  if (!currentAllowList) {
    currentAllowList = baseAllowList ? [...baseAllowList] : [];
  }
  if (!currentAllowList.includes(broadcasterAddress)) {
    currentAllowList.push(broadcasterAddress);
  }
  wakuClient.setAddressFilters(currentAllowList, currentBlockList);
};

export const resetBroadcasterFilters = () => {
  if (!isWakuLoaded()) {
    throw new Error("Waku Client is not Loaded");
  }
  if (!wakuClient) {
    return;
  }
  currentAllowList = baseAllowList ? [...baseAllowList] : [];
  currentBlockList = baseBlockList ? [...baseBlockList] : [];
  
  // Re-add custom broadcasters
  for (const broadcaster of customBroadcasters) {
    if (!currentAllowList.includes(broadcaster)) {
      currentAllowList.push(broadcaster);
    }
  }
  
  wakuClient.setAddressFilters(currentAllowList, currentBlockList);
};
