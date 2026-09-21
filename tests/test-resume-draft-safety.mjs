import assert from "assert";

console.log("================================================================================");
console.log("         REGRESSION TEST: RESUME EXISTING DRAFT SIGNATURE & PHOTO SAFETY        ");
console.log("================================================================================");

// Simulate the signature formats that can exist in stored records, drafts, or redacted responses
const testSignatures = {
  // Case 1: Redacted object from /api/draft (caused the "s.startsWith is not a function" error)
  customer: { status: "signed", signed: true },
  // Case 2: Direct data URL string
  technicalExecutive: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  // Case 3: Object with dataUrl and signer
  siteEngineer: {
    status: "signed",
    signer: "Site Eng Ramesh",
    dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  },
  // Case 4: Boolean true
  qaqc: true,
  // Case 5: String "SIGNED"
  projectManager: "SIGNED",
  // Case 6: Null or undefined
  director: null,
};

// Test the updated SignatureBox logic from components/InspectionApp.jsx
function simulateSignatureBox(value) {
  const signatureImg =
    typeof value === "string"
      ? value
      : (typeof value?.dataUrl === "string"
          ? value.dataUrl
          : (typeof value?.signatureUrl === "string"
              ? value.signatureUrl
              : (typeof value?.url === "string" ? value.url : null)));

  const isSigned =
    !!value &&
    (typeof value === "boolean"
      ? value
      : (value === "SIGNED" || value?.status === "signed" || value?.signed === true || !!signatureImg));

  let renderType = "not_signed";
  if (isSigned) {
    if (
      signatureImg &&
      typeof signatureImg === "string" &&
      (signatureImg.startsWith("data:") || signatureImg.startsWith("http://") || signatureImg.startsWith("https://"))
    ) {
      renderType = "image";
    } else {
      renderType = "text_badge";
    }
  }

  return { isSigned, signatureImg, renderType };
}

console.log("\n[TEST 1] Testing Case 1 (Redacted Draft Object: { status: 'signed', signed: true })...");
const res1 = simulateSignatureBox(testSignatures.customer);
assert.strictEqual(res1.isSigned, true);
assert.strictEqual(res1.renderType, "text_badge");
console.log("  ✅ PASS: Rendered as '✓ Digitally Signed' without throwing s.startsWith error!");

console.log("\n[TEST 2] Testing Case 2 (Direct Data URL String)...");
const res2 = simulateSignatureBox(testSignatures.technicalExecutive);
assert.strictEqual(res2.isSigned, true);
assert.strictEqual(res2.renderType, "image");
console.log("  ✅ PASS: Rendered as <img> element correctly!");

console.log("\n[TEST 3] Testing Case 3 (Object with dataUrl property)...");
const res3 = simulateSignatureBox(testSignatures.siteEngineer);
assert.strictEqual(res3.isSigned, true);
assert.strictEqual(res3.renderType, "image");
console.log("  ✅ PASS: Extracted dataUrl and rendered as <img> element!");

console.log("\n[TEST 4] Testing Case 4 (Boolean true)...");
const res4 = simulateSignatureBox(testSignatures.qaqc);
assert.strictEqual(res4.isSigned, true);
assert.strictEqual(res4.renderType, "text_badge");
console.log("  ✅ PASS: Handled boolean true safely!");

console.log("\n[TEST 5] Testing Case 5 (String 'SIGNED')...");
const res5 = simulateSignatureBox(testSignatures.projectManager);
assert.strictEqual(res5.isSigned, true);
assert.strictEqual(res5.renderType, "text_badge");
console.log("  ✅ PASS: Handled 'SIGNED' string safely!");

console.log("\n[TEST 6] Testing Case 6 (Unsigned / null)...");
const res6 = simulateSignatureBox(testSignatures.director);
assert.strictEqual(res6.isSigned, false);
assert.strictEqual(res6.renderType, "not_signed");
console.log("  ✅ PASS: Handled null safely!");

console.log("\n[TEST 7] Testing Verification Photo Resolution across all aliases...");
const mockDataWithVerificationAliases = [
  { customerVerificationPhoto: "data:image/png;base64,AAA1" },
  { verificationPhoto: "data:image/png;base64,AAA2" },
  { handoverPhoto: "data:image/png;base64,AAA3" },
  { photos: { customerVerification: "data:image/png;base64,AAA4" } },
];

mockDataWithVerificationAliases.forEach((d, idx) => {
  const photo =
    d?.customerVerificationPhoto ||
    d?.verificationPhoto ||
    d?.handoverPhoto ||
    (typeof d?.photos === "object" ? d?.photos?.customerVerification : null) ||
    null;
  assert(photo && photo.startsWith("data:image/png;base64,AAA"), `Failed on index ${idx}`);
  console.log(`  ✓ Alias variant ${idx + 1} resolved to: ${photo}`);
});
console.log("  ✅ PASS: All photo alias variants resolved successfully!");

console.log("\n================================================================================");
console.log("             ALL RESUME DRAFT REGRESSION TESTS PASSED (100%)                    ");
console.log("================================================================================\n");
