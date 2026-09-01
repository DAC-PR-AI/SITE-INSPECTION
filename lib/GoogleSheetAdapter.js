/**
 * Centralized Google Sheet Adapter Service
 * Bi-directional translation layer between frozen Google Sheet contract and application data model.
 * Documented in /docs/GOOGLE_SHEET_CONTRACT.md
 */

const CHUNK_SIZE = 45000;
const CHUNK_COLUMNS = 12;
const SIG_CHUNK_COLUMNS = 20;

export class GoogleSheetAdapter {
  /**
   * Helper: Chunk long text into fixed-size column arrays
   */
  static chunkString(str, chunkSize = CHUNK_SIZE, numChunks = CHUNK_COLUMNS) {
    const chunks = [];
    const text = str || "";
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    while (chunks.length < numChunks) chunks.push("");
    return chunks;
  }

  /**
   * Translates raw Google Sheet row array from `Inspections` tab into Application Inspection Object
   */
  static sheetRowToInspection(row = []) {
    if (!row || row.length === 0) return null;

    const [
      inspectionId,
      project,
      unit,
      inspectionType,
      customerName,
      date,
      time,
      status,
      completionPct,
      passed,
      failed,
      na,
      declarationChecked,
      updatedAt,
      submittedAt,
      ...jsonChunks
    ] = row;

    // Reassemble JSON payload from DataJSON_1..12
    let parsedData = {};
    const rawJson = jsonChunks.join("");
    if (rawJson) {
      try {
        parsedData = JSON.parse(rawJson);
      } catch (err) {
        console.warn(`[GoogleSheetAdapter] Failed to parse DataJSON for ${inspectionId}:`, err.message);
      }
    }

    // Derive application object, fallback to derived in-memory values if missing
    return {
      inspectionId: inspectionId || parsedData.inspectionId || "DAC-UNKNOWN",
      projectName: project || parsedData.projectName || "Default Project",
      unitNumber: unit || parsedData.unitNumber || "000",
      inspectionType: inspectionType || parsedData.inspectionType || "INTERIOR JOINT INSPECTION",
      customerName: customerName || parsedData.customerName || "N/A",
      date: date || parsedData.date || new Date().toISOString().split("T")[0],
      time: time || parsedData.time || "10:00 AM",
      workflowStatus: status || parsedData.workflowStatus || parsedData.status || "DRAFT",
      status: status || parsedData.status || "DRAFT",
      completionPct: completionPct || parsedData.completionPct || "0%",
      passedCount: Number(passed) || 0,
      failedCount: Number(failed) || 0,
      naCount: Number(na) || 0,
      declarationChecked: declarationChecked === "true" || declarationChecked === true,
      updatedAt: updatedAt || parsedData.updatedAt || new Date().toISOString(),
      createdAt: submittedAt || parsedData.createdAt || new Date().toISOString(),
      cells: parsedData.cells || {},
      defects: parsedData.defects || [],
      signatures: parsedData.signatures || {},
      approvalHistory: parsedData.approvalHistory || [],
    };
  }

  /**
   * Serializes Application Inspection Object into raw Google Sheet row array matching `Inspections` tab schema
   */
  static inspectionToSheetRow(inspection = {}) {
    const inspectionId = inspection.inspectionId || `DAC-${Date.now()}`;
    const project = inspection.projectName || "Default Project";
    const unit = inspection.unitNumber || "000";
    const inspectionType = inspection.inspectionType || "INTERIOR JOINT INSPECTION";
    const customerName = inspection.customerName || "N/A";
    const date = inspection.date || new Date().toISOString().split("T")[0];
    const time = inspection.time || "10:00 AM";
    const status = inspection.workflowStatus || inspection.status || "DRAFT";

    // Compute cell statistics in-memory
    const cells = inspection.cells || {};
    let passed = 0;
    let failed = 0;
    let na = 0;
    let total = Object.keys(cells).length;

    Object.values(cells).forEach((c) => {
      if (c?.status === "pass") passed++;
      else if (c?.status === "fail") failed++;
      else if (c?.status === "na") na++;
    });

    const completionPct = total > 0 ? `${Math.round(((passed + failed + na) / total) * 100)}%` : "0%";
    const declarationChecked = inspection.declarationChecked ? "true" : "false";
    const updatedAt = inspection.updatedAt || new Date().toISOString();
    const submittedAt = inspection.createdAt || updatedAt;

    // Serialize payload into DataJSON_1..12
    const jsonStr = JSON.stringify({
      ...inspection,
      inspectionId,
      projectName: project,
      unitNumber: unit,
      inspectionType,
      customerName,
      workflowStatus: status,
      status,
      updatedAt,
    });

    const jsonChunks = this.chunkString(jsonStr, CHUNK_SIZE, CHUNK_COLUMNS);

    return [
      inspectionId,
      project,
      unit,
      inspectionType,
      customerName,
      date,
      time,
      status,
      completionPct,
      passed,
      failed,
      na,
      declarationChecked,
      updatedAt,
      submittedAt,
      ...jsonChunks,
    ];
  }

  /**
   * Translates raw Google Sheet row array from `ApprovalHistory` tab into Application Object
   */
  static sheetRowToApprovalHistory(row = []) {
    if (!row || row.length === 0) return null;
    const [
      inspectionId,
      project,
      unit,
      inspectionType,
      role,
      userName,
      action,
      status,
      comments,
      timestamp,
      signatureCaptured,
    ] = row;

    return {
      inspectionId,
      project,
      unit,
      inspectionType,
      role,
      userName,
      action,
      status,
      comments: comments || "",
      timestamp: timestamp || new Date().toISOString(),
      signatureCaptured: signatureCaptured === "true" || signatureCaptured === true,
    };
  }

  /**
   * Serializes Application Approval History Record into raw row array matching `ApprovalHistory` tab schema
   */
  static approvalHistoryToSheetRow(record = {}) {
    return [
      record.inspectionId || "",
      record.project || record.projectName || "",
      record.unit || record.unitNumber || "",
      record.inspectionType || "INTERIOR JOINT INSPECTION",
      record.role || "",
      record.userName || "",
      record.action || "approved",
      record.status || "SITE_ENGINEER_PENDING",
      record.comments || "",
      record.timestamp || new Date().toISOString(),
      record.signatureCaptured ? "true" : "false",
    ];
  }

  /**
   * Reassembles raw stroke chunks from `Signatures` tab into application signature object
   */
  static sheetRowToSignature(row = []) {
    if (!row || row.length === 0) return null;
    const [inspectionId, role, signerName, timestamp, ...sigChunks] = row;
    const base64Data = sigChunks.join("");

    return {
      inspectionId,
      role,
      signerName,
      timestamp,
      dataUrl: base64Data,
    };
  }

  /**
   * Serializes signature stroke into raw row array matching `Signatures` tab schema
   */
  static signatureToSheetRow(sigRecord = {}) {
    const sigChunks = this.chunkString(sigRecord.dataUrl || sigRecord.signature || "", CHUNK_SIZE, SIG_CHUNK_COLUMNS);
    return [
      sigRecord.inspectionId || "",
      sigRecord.role || "",
      sigRecord.signerName || sigRecord.userName || "",
      sigRecord.timestamp || new Date().toISOString(),
      ...sigChunks,
    ];
  }
}
