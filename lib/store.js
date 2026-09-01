import * as sheetsStore from "./sheets.js";
import * as localStore from "./localStore.js";

const SHEETS_ENV_VARS = [
  "GOOGLE_SHEETS_CLIENT_EMAIL",
  "GOOGLE_SHEETS_PRIVATE_KEY",
  "GOOGLE_SHEET_ID",
];

export function isUsingSheets() {
  return SHEETS_ENV_VARS.every((k) => !!process.env[k] && process.env[k].trim().length > 0);
}

export const usingSheets = isUsingSheets();
export const backendName = isUsingSheets() ? "sheets" : "local";

// Helper for brief sleep in retry logic
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export async function getProjects() {
  if (isUsingSheets()) {
    try {
      const projs = await sheetsStore.getProjects();
      if (projs && Object.keys(projs).length > 0) return projs;
    } catch (err) {
      console.warn("[store] Google Sheets getProjects failed, falling back to local/seed projects:", err.message);
    }
  }
  return localStore.getProjects();
}

export async function upsertInspection(data, opts) {
  // Always update localStore in parallel to ensure immediate local consistency
  localStore.upsertInspection(data, opts).catch((e) => console.warn("[store] Local sync warning:", e.message));

  if (isUsingSheets()) {
    try {
      return await sheetsStore.upsertInspection(data, opts);
    } catch (err) {
      console.error("[store] Primary Google Sheets upsert failed:", err.message);

      // If rate limited (quota exceeded) or transient network issue, retry once after 1s
      if (err.message?.includes("Quota exceeded") || err.message?.includes("429") || err.code === "ECONNRESET") {
        try {
          console.log("[store] Retrying Sheets upsert after 1000ms delay...");
          await sleep(1000);
          return await sheetsStore.upsertInspection(data, opts);
        } catch (retryErr) {
          console.error("[store] Sheets retry failed:", retryErr.message);
        }
      }

      // Emergency local fallback to ensure user data is NEVER lost
      try {
        console.warn("[store] Storing to emergency local store to prevent data loss.");
        return await localStore.upsertInspection(data, opts);
      } catch (localErr) {
        console.error("[store] Emergency local store failed:", localErr.message);
        throw err;
      }
    }
  }
  return localStore.upsertInspection(data, opts);
}

export async function getInspection(inspectionId) {
  if (isUsingSheets()) {
    try {
      const item = await sheetsStore.getInspection(inspectionId);
      if (item) return item;
    } catch (err) {
      console.warn("[store] Google Sheets getInspection failed, trying local fallback:", err.message);
    }
  }
  return localStore.getInspection(inspectionId);
}

export async function getAllInspections() {
  if (isUsingSheets()) {
    try {
      const list = await sheetsStore.getAllInspections();
      if (Array.isArray(list)) return list;
    } catch (err) {
      console.warn("[store] Google Sheets getAllInspections failed, trying local fallback:", err.message);
    }
  }
  return localStore.getAllInspections();
}

export async function getUserByEmail(email) {
  if (isUsingSheets()) {
    try {
      const user = await sheetsStore.getUserByEmail(email);
      if (user) return user;
    } catch (err) {
      console.warn("[store] Google Sheets getUserByEmail failed, falling back to localStore:", err.message);
    }
  }
  return localStore.getUserByEmail ? localStore.getUserByEmail(email) : null;
}

export async function getUserByNameAndNumber(name, number) {
  if (isUsingSheets()) {
    try {
      const user = await sheetsStore.getUserByNameAndNumber(name, number);
      if (user) return user;
    } catch (err) {
      console.warn("[store] Google Sheets getUserByNameAndNumber failed, falling back to localStore:", err.message);
    }
  }
  return localStore.getUserByNameAndNumber ? localStore.getUserByNameAndNumber(name, number) : null;
}

export async function getUserByPassword(password) {
  if (isUsingSheets()) {
    try {
      const user = await sheetsStore.getUserByPassword(password);
      if (user) return user;
    } catch (err) {
      console.warn("[store] Google Sheets getUserByPassword failed, falling back to localStore:", err.message);
    }
  }
  return localStore.getUserByPassword ? localStore.getUserByPassword(password) : null;
}

export function computeStats(data) {
  try {
    return (isUsingSheets() ? sheetsStore : localStore).computeStats(data);
  } catch {
    return { passed: 0, failed: 0, na: 0, pct: 0 };
  }
}
