/**
 * Regression Test: Signature De-duplication & Persist Filtering
 *
 * Verifies that duplicate signature entries produced by reads (e.g. role display name,
 * "<role>_data", and camelCase alias) are filtered before persistence, preventing
 * exponential JSON bloat and Google Sheets quota errors across multi-stage approval chains.
 */

import assert from "node:assert/strict";
import { SIGNATURE_ROLE_ALIASES, getPersistableSignatures } from "../lib/signatureUtils.js";

console.log("================================================================");
console.log("   SIGNATURE DE-DUPLICATION & PERSIST FILTER REGRESSION TEST    ");
console.log("================================================================\n");

// Helper to simulate getSignaturesForInspection() read expansion
function expandSignaturesForRead(persistedSignatures) {
  const readView = {};
  for (const [roleKey, sigObj] of Object.entries(persistedSignatures)) {
    if (!sigObj) continue;
    const base64 = typeof sigObj === "string" ? sigObj : sigObj.dataUrl || sigObj.signature || sigObj.sigData || "";
    
    // 1. Raw entry
    readView[roleKey] = sigObj;
    
    // 2. _data raw copy
    readView[`${roleKey}_data`] = base64;
    
    // 3. camelCase alias if roleKey is display name
    const camel = SIGNATURE_ROLE_ALIASES[roleKey];
    if (camel) {
      readView[camel] = sigObj;
    }
  }
  return readView;
}

// ---------------------------------------------------------------------------
// TEST 1: Triple-view de-duplication
// ---------------------------------------------------------------------------
console.log("1. Testing triple-view deduplication (Site Engineer)...");
{
  const input = {
    "Site Engineer": { dataUrl: "data:image/png;base64,AAA111", signer: "Arun", status: "signed" },
    "siteEngineer": { dataUrl: "data:image/png;base64,AAA111", signer: "Arun", status: "signed" },
    "Site Engineer_data": "data:image/png;base64,AAA111",
  };

  const filtered = getPersistableSignatures(input);
  const filteredMap = Object.fromEntries(filtered);

  assert.equal(filtered.length, 1, "Must keep exactly 1 entry");
  assert.ok(filteredMap.siteEngineer, "Must keep the camelCase 'siteEngineer' key");
  assert.equal(filteredMap["Site Engineer"], undefined, "Must drop display name 'Site Engineer' when camelCase exists");
  assert.equal(filteredMap["Site Engineer_data"], undefined, "Must drop 'Site Engineer_data'");
  console.log("  ✅ PASS: Only 'siteEngineer' kept from triple-view input");
}

// ---------------------------------------------------------------------------
// TEST 2: _data and _data_data keys always dropped
// ---------------------------------------------------------------------------
console.log("\n2. Testing dropping of _data and _data_data keys...");
{
  const input = {
    "Customer_data": "data:image/png;base64,CUSTDATA",
    "Customer_data_data": "data:image/png;base64,NESTED",
    "qaqc_data": "data:image/png;base64,QAQCDATA",
    "UnknownRole_data": "data:image/png;base64,UNKNOWN",
    "customRole_data_data": "data:image/png;base64,DOUBLE",
  };

  const filtered = getPersistableSignatures(input);
  assert.equal(filtered.length, 0, "All _data and _data_data keys must be dropped");
  console.log("  ✅ PASS: All '_data' and '_data_data' keys dropped successfully");
}

// ---------------------------------------------------------------------------
// TEST 3: Role-name key without camelCase twin is kept
// ---------------------------------------------------------------------------
console.log("\n3. Testing preservation of role-name key without camelCase twin...");
{
  const input = {
    "Site Engineer": { dataUrl: "data:image/png;base64,SOLO", signer: "Arun", status: "signed" },
    "Custom Reviewer": { dataUrl: "data:image/png;base64,CUSTOM", signer: "Alex", status: "signed" },
  };

  const filtered = getPersistableSignatures(input);
  const filteredMap = Object.fromEntries(filtered);

  assert.equal(filtered.length, 2, "Must keep both entries since no camelCase twins exist");
  assert.ok(filteredMap["Site Engineer"], "Must keep 'Site Engineer' when 'siteEngineer' is absent");
  assert.ok(filteredMap["Custom Reviewer"], "Must keep custom role without alias mapping");
  console.log("  ✅ PASS: Role-name keys without camelCase twins preserved");
}

// ---------------------------------------------------------------------------
// TEST 4: 8-Stage sequential approval chain simulation with ~25,000-char sigs
// ---------------------------------------------------------------------------
console.log("\n4. Simulating 8 sequential approvals with ~25KB signatures...");
{
  const ROLES = [
    { roleName: "Customer", camel: "customer", signer: "Priya" },
    { roleName: "Site Engineer", camel: "siteEngineer", signer: "Arun" },
    { roleName: "QA/QC In-Charge", camel: "qaqc", signer: "Kumar" },
    { roleName: "Technical Executive", camel: "technicalExecutive", signer: "Raj" },
    { roleName: "Project Manager", camel: "projectManager", signer: "PM User" },
    { roleName: "Manager Technical", camel: "managerTechnical", signer: "Tech Manager" },
    { roleName: "GM – HUG", camel: "gmHug", signer: "GM User" },
    { roleName: "VP – HUG", camel: "vpHug", signer: "VP User" },
  ];

  // Base64 chunk of ~25,000 characters
  const SAMPLE_SIG_25K = "data:image/png;base64," + "A".repeat(25000);

  let storedPersistedSignatures = {};

  for (let stage = 0; stage < ROLES.length; stage++) {
    const { roleName, camel, signer } = ROLES[stage];

    // Step A: Read expands stored signatures to 3 views (roleName, roleName_data, camel)
    const readView = expandSignaturesForRead(storedPersistedSignatures);

    // Step B: Current approver signs (portal supplies camelCase or roleName)
    readView[camel] = {
      dataUrl: SAMPLE_SIG_25K,
      signer,
      status: "signed",
      timestamp: new Date().toISOString(),
    };

    // Step C: Filter before saving
    const persistableEntries = getPersistableSignatures(readView);
    const newPersisted = Object.fromEntries(persistableEntries);

    // Step D: In full flow, metadata in Inspections JSON strips dataUrl, while Signatures tab holds full base64
    // Test both:
    // 1) Lightweight metadata (as stored in Inspections sheet JSON)
    const inspectionJsonSignatures = {};
    for (const [key, val] of persistableEntries) {
      if (typeof val === "object" && val !== null) {
        const { dataUrl: _d, ...rest } = val;
        inspectionJsonSignatures[key] = { ...rest, status: "signed" };
      } else {
        inspectionJsonSignatures[key] = val;
      }
    }

    storedPersistedSignatures = newPersisted;

    const fullPersistedJson = JSON.stringify(storedPersistedSignatures);
    const metadataJson = JSON.stringify(inspectionJsonSignatures);

    const entryCount = persistableEntries.length;
    const expectedCount = stage + 1;

    assert.equal(
      entryCount,
      expectedCount,
      `Stage ${expectedCount} (${roleName}) must have exactly ${expectedCount} persisted signature entries, got ${entryCount}`
    );

    // Full persisted size with 25KB raw strings must stay well under 300,000 characters (8 * ~25.1KB = ~201KB)
    assert.ok(
      fullPersistedJson.length < 300000,
      `Full persisted JSON length (${fullPersistedJson.length}) must be < 300,000 characters at stage ${expectedCount}`
    );

    // Main Inspections row JSON metadata must stay tiny (< 5,000 characters)
    assert.ok(
      metadataJson.length < 5000,
      `Metadata JSON length (${metadataJson.length}) must be < 5,000 characters at stage ${expectedCount}`
    );
  }

  console.log(`  ✅ PASS: Completed 8-stage approval simulation.`);
  console.log(`     - Final persisted entries count: ${Object.keys(storedPersistedSignatures).length} (max 8)`);
  console.log(`     - Full signatures JSON size: ${JSON.stringify(storedPersistedSignatures).length.toLocaleString()} chars (< 300,000 limit)`);
}

console.log("\n================================================================");
console.log("   ALL SIGNATURE DEDUPLICATION TESTS PASSED (4/4)               ");
console.log("================================================================\n");
