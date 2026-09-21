import assert from "assert";
import { GoogleSheetAdapter } from "../lib/GoogleSheetAdapter.js";
import { upsertInspection, getInspection } from "../lib/localStore.js";

console.log("================================================================");
console.log("   TESTING FIELD PRESERVATION: VERIFICATION PHOTO & INTERIOR DAYS");
console.log("================================================================");

const mockSamplePhoto = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// 1. Test GoogleSheetAdapter serialization and deserialization
console.log("\n1. Testing GoogleSheetAdapter serialization & round-trip deserialization...");
const inspectionPayload = {
  inspectionId: "DAC-TEST-PRINT-999",
  projectName: "DAC Silicon Valley",
  unitNumber: "A-102",
  inspectionType: "FINAL JOINT INSPECTION",
  customerName: "RAGIL",
  inspectionDate: "2026-09-21",
  inspectionTime: "11:30 AM",
  workflowStatus: "COMPLETED",
  status: "COMPLETED",
  declarationChecked: true,
  interiorDays: "45",
  customerVerificationPhoto: mockSamplePhoto,
  generalRemarks: "All handover checks completed satisfactorily.",
  cells: {
    "1__living": { status: "pass", remarks: "" },
    "1__dining": { status: "pass", remarks: "" },
  },
  signatures: {
    customer: { status: "signed", signer: "RAGIL", timestamp: "2026-09-21T11:30:00Z" },
    siteEngineer: { status: "signed", signer: "Site Eng", timestamp: "2026-09-21T11:35:00Z" },
  },
};

const sheetRow = GoogleSheetAdapter.inspectionToSheetRow(inspectionPayload);
assert(Array.isArray(sheetRow), "Expected sheetRow to be an array");
assert.strictEqual(sheetRow[0], "DAC-TEST-PRINT-999");

const deserialized = GoogleSheetAdapter.sheetRowToInspection(sheetRow);
assert(deserialized, "Expected deserialized inspection to be non-null");
assert.strictEqual(deserialized.inspectionId, "DAC-TEST-PRINT-999");
assert.strictEqual(deserialized.customerName, "RAGIL");
assert.strictEqual(deserialized.interiorDays, "45", "Expected interiorDays to be preserved as '45'");
assert.strictEqual(deserialized.customerVerificationPhoto, mockSamplePhoto, "Expected customerVerificationPhoto to be preserved");
assert.strictEqual(deserialized.generalRemarks, "All handover checks completed satisfactorily.");
console.log("  ✅ PASS: GoogleSheetAdapter round-trip preserved customerVerificationPhoto and interiorDays ('45')");

// 2. Testing Fallback Aliases in GoogleSheetAdapter
console.log("\n2. Testing alias fallbacks ('days', 'verificationPhoto', 'handoverPhoto')...");
const legacyPayload = {
  inspectionId: "DAC-TEST-LEGACY-888",
  projectName: "DAC Silicon Valley",
  unitNumber: "B-204",
  customerName: "JOHN DOE",
  days: "60",
  verificationPhoto: mockSamplePhoto,
};
const legacyRow = GoogleSheetAdapter.inspectionToSheetRow(legacyPayload);
const legacyDeserialized = GoogleSheetAdapter.sheetRowToInspection(legacyRow);
assert.strictEqual(legacyDeserialized.interiorDays, "60", "Expected 'days' to fall back into 'interiorDays'");
assert.strictEqual(legacyDeserialized.customerVerificationPhoto, mockSamplePhoto, "Expected 'verificationPhoto' to fall back into 'customerVerificationPhoto'");
console.log("  ✅ PASS: Alias fallbacks correctly populated interiorDays and customerVerificationPhoto");

// 3. Testing Local Store Persistence
console.log("\n3. Testing localStore upsert and retrieval...");
await upsertInspection(inspectionPayload);
const storedItem = await getInspection("DAC-TEST-PRINT-999");
assert(storedItem, "Expected storedItem to be non-null");
assert.strictEqual(storedItem.interiorDays, "45", "Expected stored interiorDays to be '45'");
assert.strictEqual(storedItem.customerVerificationPhoto, mockSamplePhoto, "Expected stored customerVerificationPhoto to be preserved");
console.log("  ✅ PASS: localStore correctly preserved interiorDays and customerVerificationPhoto");

console.log("\n================================================================");
console.log("   ALL FIELD RESOLUTION TESTS PASSED! (3/3)");
console.log("================================================================\n");
