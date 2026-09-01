/**
 * Centralized Sheet → Application Field Mapping Configuration
 * Maps exact frozen Google Sheet headers to internal Application Data Model properties.
 * Documented in /docs/SHEET_DATA_MAPPING.md
 */

export const SHEET_FIELD_MAPPINGS = {
  Inspections: {
    InspectionId: { appField: "inspectionId", type: "ID", required: true, fallback: "DAC-UNKNOWN" },
    Project: { appField: "projectName", type: "STRING", required: true, fallback: "Default Project" },
    Unit: { appField: "unitNumber", type: "STRING", required: true, fallback: "000" },
    InspectionType: { appField: "inspectionType", type: "STRING", required: true, fallback: "INTERIOR JOINT INSPECTION" },
    CustomerName: { appField: "customerName", type: "STRING", required: false, fallback: "N/A" },
    Date: { appField: "date", type: "DATE", required: false, fallback: () => new Date().toISOString().split("T")[0] },
    Time: { appField: "time", type: "TIME", required: false, fallback: "10:00 AM" },
    Status: { appField: "workflowStatus", type: "STATUS", required: true, fallback: "DRAFT" },
    CompletionPct: { appField: "completionPct", type: "PERCENT", required: false, fallback: "0%" },
    Passed: { appField: "passedCount", type: "NUMBER", required: false, fallback: 0 },
    Failed: { appField: "failedCount", type: "NUMBER", required: false, fallback: 0 },
    NA: { appField: "naCount", type: "NUMBER", required: false, fallback: 0 },
    DeclarationChecked: { appField: "declarationChecked", type: "BOOLEAN", required: false, fallback: false },
    UpdatedAt: { appField: "updatedAt", type: "ISODATE", required: false, fallback: () => new Date().toISOString() },
    SubmittedAt: { appField: "createdAt", type: "ISODATE", required: false, fallback: () => new Date().toISOString() },
  },

  Projects: {
    Project: { appField: "projectName", type: "STRING", required: true, fallback: "Default Project" },
    Unit: { appField: "unitNumber", type: "STRING", required: true, fallback: "000" },
  },

  ApprovalHistory: {
    InspectionID: { appField: "inspectionId", type: "ID", required: true, fallback: "DAC-UNKNOWN" },
    Project: { appField: "projectName", type: "STRING", required: false, fallback: "N/A" },
    Unit: { appField: "unitNumber", type: "STRING", required: false, fallback: "N/A" },
    InspectionType: { appField: "inspectionType", type: "STRING", required: false, fallback: "INTERIOR JOINT INSPECTION" },
    Role: { appField: "role", type: "STRING", required: true, fallback: "Approver" },
    UserName: { appField: "userName", type: "STRING", required: true, fallback: "Staff" },
    Action: { appField: "action", type: "STRING", required: true, fallback: "approved" },
    Status: { appField: "status", type: "STATUS", required: true, fallback: "SITE_ENGINEER_PENDING" },
    Comments: { appField: "comments", type: "STRING", required: false, fallback: "" },
    Timestamp: { appField: "timestamp", type: "ISODATE", required: true, fallback: () => new Date().toISOString() },
    SignatureCaptured: { appField: "signatureCaptured", type: "BOOLEAN", required: false, fallback: false },
  },

  Signatures: {
    InspectionId: { appField: "inspectionId", type: "ID", required: true, fallback: "DAC-UNKNOWN" },
    Role: { appField: "role", type: "STRING", required: true, fallback: "Customer" },
    SignerName: { appField: "signerName", type: "STRING", required: false, fallback: "Unknown Signer" },
    Timestamp: { appField: "timestamp", type: "ISODATE", required: true, fallback: () => new Date().toISOString() },
  },

  InspectionPhotos: {
    InspectionID: { appField: "inspectionId", type: "ID", required: true, fallback: "DAC-UNKNOWN" },
    Project: { appField: "projectName", type: "STRING", required: false, fallback: "N/A" },
    Unit: { appField: "unitNumber", type: "STRING", required: false, fallback: "N/A" },
    PhotoType: { appField: "photoType", type: "STRING", required: false, fallback: "general" },
    AreaKey: { appField: "areaKey", type: "STRING", required: false, fallback: "General" },
    ItemID: { appField: "itemId", type: "STRING", required: false, fallback: "Item" },
    PhotoURL: { appField: "photoUrl", type: "STRING", required: true, fallback: "" },
    Timestamp: { appField: "timestamp", type: "ISODATE", required: true, fallback: () => new Date().toISOString() },
  },
};

/**
 * Sanitizes and coerces raw Google Sheet value to target Application type
 */
export function sanitizeSheetValue(rawValue, typeConfig) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return typeof typeConfig.fallback === "function" ? typeConfig.fallback() : typeConfig.fallback;
  }

  const valStr = String(rawValue).trim();

  switch (typeConfig.type) {
    case "NUMBER": {
      const parsed = parseInt(valStr, 10);
      return isNaN(parsed) ? typeConfig.fallback : parsed;
    }
    case "BOOLEAN": {
      return valStr.toLowerCase() === "true" || valStr.toLowerCase() === "yes" || valStr === "1";
    }
    case "PERCENT": {
      return valStr.includes("%") ? valStr : `${valStr}%`;
    }
    case "STATUS": {
      return valStr.toUpperCase().replaceAll(" ", "_");
    }
    default:
      return valStr;
  }
}
