/**
 * Security utilities for input sanitization, parameter validation, and threat mitigation.
 */

/**
 * Sanitize plain text inputs to prevent XSS and script injection.
 * Strips HTML tags, script elements, and dangerous characters.
 */
export function sanitizeText(str, maxLength = 2000) {
  if (typeof str !== "string") return "";
  let clean = str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "") // strip all HTML tags
    .replace(/javascript:/gi, "")
    .replace(/data:/gi, (match, offset) => (offset === 0 ? match : "")) // preserve data URLs only if at start
    .trim();

  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }
  return clean;
}

/**
 * Sanitize an identifier string (e.g. inspectionId, areaKey, itemId) to alphanumeric + hyphen/underscore.
 * Prevents path traversal and header/query injection attacks.
 */
export function sanitizeIdentifier(str, defaultValue = "unknown") {
  if (!str || typeof str !== "string" && typeof str !== "number") return defaultValue;
  const cleaned = String(str).replace(/[^a-zA-Z0-9_\-]/g, "").trim();
  return cleaned.length > 0 ? cleaned : defaultValue;
}

/**
 * Validates whether a string is a safe image Data URL (JPEG, PNG, WEBP).
 * @returns {{ valid: boolean, mimeType?: string, error?: string }}
 */
export function validateImageDataUrl(dataUrl, maxSizeBytes = 10 * 1024 * 1024) {
  if (!dataUrl || typeof dataUrl !== "string") {
    return { valid: false, error: "Missing image data URL." };
  }

  const matches = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!matches) {
    return {
      valid: false,
      error: "Invalid image format. Only JPEG, PNG, and WEBP base64 images are allowed.",
    };
  }

  const mimeType = matches[1].toLowerCase();
  const base64Data = matches[2];

  // Approximate binary size from Base64 length
  const approximateSizeBytes = Math.ceil((base64Data.length * 3) / 4);
  if (approximateSizeBytes > maxSizeBytes) {
    const sizeMb = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Image file size exceeds maximum limit of ${sizeMb} MB.`,
    };
  }

  return { valid: true, mimeType };
}

/**
 * Recursively sanitizes inspection payload text fields (generalRemarks, cell remarks, project name, customer name).
 * Strips any HTML tags or script injection payloads.
 */
export function sanitizeInspectionPayload(data) {
  if (!data || typeof data !== "object") return data;
  const clean = { ...data };

  if (clean.inspectionId) clean.inspectionId = sanitizeIdentifier(clean.inspectionId);
  if (clean.projectName) clean.projectName = sanitizeText(clean.projectName, 200);
  if (clean.unitNumber) clean.unitNumber = sanitizeText(clean.unitNumber, 50);
  if (clean.customerName) clean.customerName = sanitizeText(clean.customerName, 200);
  if (clean.generalRemarks) clean.generalRemarks = sanitizeText(clean.generalRemarks, 4000);

  if (clean.cells && typeof clean.cells === "object") {
    const sanitizedCells = {};
    for (const [key, cell] of Object.entries(clean.cells)) {
      if (cell && typeof cell === "object") {
        sanitizedCells[key] = {
          ...cell,
          remarks: cell.remarks ? sanitizeText(cell.remarks, 2000) : "",
        };
      } else {
        sanitizedCells[key] = cell;
      }
    }
    clean.cells = sanitizedCells;
  }

  return clean;
}
