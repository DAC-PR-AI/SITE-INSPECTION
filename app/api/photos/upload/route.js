import { NextResponse } from "next/server";
import { uploadPhotoToDrive } from "../../../../lib/drive";
import { checkRateLimit, recordFailedAttempt, clearRateLimit, getClientIp } from "../../../../lib/rateLimit";
import { sanitizeIdentifier, validateImageDataUrl } from "../../../../lib/security";

/**
 * /api/photos/upload - Secure photo upload endpoint
 *
 * Security Controls:
 * 1. IP Rate Limiting (20 uploads per 15 min per IP)
 * 2. Strict Image Data URL & MIME validation (JPEG, PNG, WEBP only)
 * 3. 10 MB payload ceiling limit
 * 4. Alphanumeric input parameter sanitization (prevents path traversal/injection)
 */
export async function POST(request) {
  try {
    const ip = getClientIp(request);

    // Rate limit check: max 20 uploads per IP per 15 min window
    const { limited, resetInMs } = checkRateLimit(ip, "PHOTO_UPLOAD", 20);
    if (limited) {
      const minutes = Math.ceil(resetInMs / 60000);
      return NextResponse.json(
        { error: `Upload rate limit exceeded. Please try again in ${minutes} minute(s).` },
        { status: 429 }
      );
    }

    // Always record attempt count for rate limit tracking
    recordFailedAttempt(ip, "PHOTO_UPLOAD");

    let data;
    try {
      data = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request payload." }, { status: 400 });
    }

    if (!data || !data.dataUrl) {
      return NextResponse.json({ error: "Missing required photo dataUrl parameter." }, { status: 400 });
    }

    // Security Validation: MIME type, base64 structure, max 10MB size
    const imageValidation = validateImageDataUrl(data.dataUrl, 10 * 1024 * 1024);
    if (!imageValidation.valid) {
      recordFailedAttempt(ip, "PHOTO_UPLOAD");
      return NextResponse.json({ error: imageValidation.error }, { status: 400 });
    }

    const { inspectionId, photoType, itemId, areaKey, dataUrl } = data;

    // Sanitize parameters to prevent path traversal or header manipulation
    const safeInspectionId = sanitizeIdentifier(inspectionId, "INSPECTION");
    const safePhotoType = sanitizeIdentifier(photoType, "photo");
    const safeItemId = sanitizeIdentifier(itemId, "item");
    const safeAreaKey = sanitizeIdentifier(areaKey, "area");

    const timestamp = Date.now();
    let filename = `${safeInspectionId}_${timestamp}.jpg`;

    if (safePhotoType === "customerVerification") {
      filename = `${safeInspectionId}_verification_${timestamp}.jpg`;
    } else if (safePhotoType === "fail" || safePhotoType === "pass") {
      filename = `${safeInspectionId}_${safePhotoType}_item${safeItemId}_${safeAreaKey}_${timestamp}.jpg`;
    }

    const result = await uploadPhotoToDrive({ filename, dataUrl });

    if (!result.ok) {
      console.warn(
        "[photos/upload] Drive upload skipped/failed (" +
          result.error +
          "), using resilient inline Base64 storage."
      );
      return NextResponse.json({
        ok: true,
        url: dataUrl,
        fileId: null,
        fallback: true,
        warning: result.error,
      });
    }

    return NextResponse.json({
      ok: true,
      url: result.url,
      fileId: result.fileId,
    });
  } catch (err) {
    console.error("[photos] POST unexpected error:", err);
    return NextResponse.json({ error: "Server error handling photo upload." }, { status: 500 });
  }
}
