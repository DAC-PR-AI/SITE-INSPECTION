/**
 * Pure utility functions and constants for signature normalization and de-duplication.
 */

// Role display name -> camelCase signature key. getSignaturesForInspection() exposes each
// signature under both names (plus a "<role>_data" copy); only the camelCase one is persisted.
export const SIGNATURE_ROLE_ALIASES = {
  "Customer": "customer",
  "Site Engineer": "siteEngineer",
  "QA/QC In-Charge": "qaqc",
  "QA/QC": "qaqc",
  "Project Manager": "projectManager",
  "Technical Executive": "technicalExecutive",
  "Manager Technical": "managerTechnical",
  "Manager – Technical": "managerTechnical",
  "GM – HUG": "gmHug",
  "GM - HUG": "gmHug",
  "VP – HUG": "vpHug",
  "VP - HUG": "vpHug",
};

/**
 * Filter signatures to retain only non-redundant, canonical entries for persistence.
 * Drops:
 *  - Any key ending in "_data" (derived raw copy from read, e.g. "Site Engineer_data", "X_data_data")
 *  - Any role-name key whose camelCase twin exists in signaturesRaw (e.g. "Site Engineer" when "siteEngineer" exists)
 * Retains:
 *  - The camelCase key (e.g. "siteEngineer")
 *  - Any role-name key that does NOT have a camelCase twin present
 *
 * @param {Object} signaturesRaw
 * @returns {Array<[string, any]>} Filtered [key, value] pairs to persist
 */
export function getPersistableSignatures(signaturesRaw) {
  if (!signaturesRaw || typeof signaturesRaw !== "object") return [];
  const entries = [];
  for (const [role, value] of Object.entries(signaturesRaw)) {
    if (!value) continue;
    if (role.endsWith("_data")) continue;
    const camelKey = SIGNATURE_ROLE_ALIASES[role];
    if (camelKey && signaturesRaw[camelKey]) continue;
    entries.push([role, value]);
  }
  return entries;
}
