import * as sheetsStore from "./sheets.js";
import * as localStore from "./localStore.js";

const SHEETS_ENV_VARS = [
  "GOOGLE_SHEETS_CLIENT_EMAIL",
  "GOOGLE_SHEETS_PRIVATE_KEY",
  "GOOGLE_SHEET_ID",
];

export const usingSheets = SHEETS_ENV_VARS.every((k) => !!process.env[k]);
export const backendName = usingSheets ? "sheets" : "local";

// Helper for brief sleep in retry logic
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export async function getProjects() {
  if (usingSheets) {
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
  if (usingSheets) {
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
  if (usingSheets) {
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
  if (usingSheets) {
    try {
      const list = await sheetsStore.getAllInspections();
      if (Array.isArray(list)) return list;
    } catch (err) {
      console.warn("[store] Google Sheets getAllInspections failed, trying local fallback:", err.message);
    }
  }
  return localStore.getAllInspections();
}

export function computeStats(data) {
  try {
    return (usingSheets ? sheetsStore : localStore).computeStats(data);
  } catch {
    return { passed: 0, failed: 0, na: 0, pct: 0 };
  }
}
