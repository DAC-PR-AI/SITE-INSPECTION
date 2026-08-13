import * as sheetsStore from "./sheets.js";
import * as localStore from "./localStore.js";

const SHEETS_ENV_VARS = [
  "GOOGLE_SHEETS_CLIENT_EMAIL",
  "GOOGLE_SHEETS_PRIVATE_KEY",
  "GOOGLE_SHEET_ID",
];

export const usingSheets = SHEETS_ENV_VARS.every((k) => !!process.env[k]);
export const backendName = usingSheets ? "sheets" : "local";

function backend() {
  return usingSheets ? sheetsStore : localStore;
}

export async function getProjects() {
  return backend().getProjects();
}

export async function upsertInspection(data, opts) {
  return backend().upsertInspection(data, opts);
}

export async function getInspection(inspectionId) {
  return backend().getInspection(inspectionId);
}

export async function getAllInspections() {
  return backend().getAllInspections();
}

export async function computeStats(data) {
  return backend().computeStats(data);
}
