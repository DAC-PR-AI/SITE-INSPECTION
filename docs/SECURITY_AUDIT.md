# DAC Joint Inspection & Key Handover — Comprehensive Security Audit

This document provides a technical security review of authentication mechanisms, input validation, rate limiting, header hardening, data leakage risks, and environmental security.

---

## 1. Security Architecture Summary

```
[Incoming Request]
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. HTTP Security Headers & Content Security Policy (CSP)   │  next.config.js
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Client IP Extraction & Sliding-Window Rate Limiting      │  lib/rateLimit.js
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Input Sanitization & Base64 Image Payload Validation     │  lib/security.js
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Timing-Safe Role PIN Verification & SHA-256 Hashing       │  lib/auth.js
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Environment Variables & Secret Inventory

| Variable Name | Required | Default Fallback | Risk Level if Leaked | Description |
|---|---|---|---|---|
| `GOOGLE_SHEETS_CLIENT_EMAIL` | Optional (Sheets backend) | None | Medium | Service Account email address |
| `GOOGLE_SHEETS_PRIVATE_KEY` | Optional (Sheets backend) | None | **CRITICAL** | RSA private key for Google Cloud Service Account |
| `GOOGLE_SHEET_ID` | Optional (Sheets backend) | None | Medium | Primary Google Sheet ID |
| `GOOGLE_DRIVE_FOLDER_ID` | Optional (Drive upload) | None | Medium | Parent folder ID for photo storage |
| `GOOGLE_PHOTO_SHEET_ID` | Optional (Dual-sheet setup) | `GOOGLE_SHEET_ID` | Low | Secondary Google Sheet ID for photo logs |
| `AUTH_PIN_START_INSPECTION` | Optional | `272727` | High | Site Engineer login PIN |
| `AUTH_PIN_SITE_ENGINEER` | Optional | `272727` | High | Site Engineer approval PIN |
| `AUTH_PIN_CUSTOMER` | Optional | `111111` | Medium | Customer signature PIN |
| `AUTH_PIN_QAQC` | Optional | `202020` | High | QA/QC approval PIN |
| `AUTH_PIN_PROJECT_MANAGER` | Optional | `303030` | High | Project Manager approval PIN |
| `AUTH_PIN_TECHNICAL_EXECUTIVE` | Optional | `444444` | High | Technical Executive signature PIN |
| `AUTH_PIN_MANAGER_TECHNICAL` | Optional | `454545` | High | Manager Technical approval PIN |
| `AUTH_PIN_GM_HUG` | Optional | `404040` | High | GM – HUG approval PIN |
| `AUTH_PIN_VP_HUG` | Optional | `505050` | High | VP – HUG approval PIN |
| `AUTH_PIN_ADMIN` | Optional | `999999` | **CRITICAL** | Admin portal PIN |

> [!WARNING]
> If environment variables are omitted, the application silently defaults to predictable hardcoded PINs (`111111`, `272727`, `999999`, etc.). Production deployments MUST override all `AUTH_PIN_*` variables in Vercel.

---

## 3. Existing Security Controls Assessment

### 3.1 Authentication & Password Verification (`lib/auth.js`)
- **Control**: [`verifyRolePassword(role, pin)`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/lib/auth.js#L124-L165) uses Node.js native `crypto.timingSafeEqual` to compare entered PINs or SHA-256 hashes against expected values.
- **Strengths**:
  - Prevents side-channel timing attacks by ensuring constant-time comparison regardless of string length or character match position.
  - Supports salted SHA-256 hashes (`dac_pin_${pin}`) and direct SHA-256 hashes from client requests.
- **Weaknesses**:
  - Stateless authorization: Successful PIN check does NOT issue a session cookie, JWT, or bearer token. Subsequent API calls rely on resending the 6-digit PIN in payload.

### 3.2 Rate Limiting Protection (`lib/rateLimit.js`)
- **Control**: [`checkRateLimit(ip, roleId, maxAttempts)`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/lib/rateLimit.js#L41-L71) tracks failed authentication and API calls per IP address in an in-memory `Map`.
- **Limits**:
  - `/api/auth`: 5 attempts per 15 minutes.
  - `/api/approval`: 5 attempts per 15 minutes.
  - `/api/submit`: 5 attempts per 15 minutes.
  - `/api/photos/upload`: 20 uploads per 15 minutes.
  - `/api/draft`: 1000 requests per 15 minutes.
- **Weaknesses**:
  - Serverless Isolation: In multi-instance serverless deployments (Vercel), in-memory state is isolated per lambda instance. An attacker can bypass limits by hitting different cold-start instances. Redis or Upstash is required for distributed enforcement.

### 3.3 Input Sanitization & Image Validation (`lib/security.js`)
- **Control**:
  - [`sanitizeText(str)`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/lib/security.js#L9-L22): Strips `<script>` tags, HTML tags, and `javascript:` URIs.
  - [`sanitizeIdentifier(str)`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/lib/security.js#L28-L32): Restricts strings to alphanumeric, hyphens, and underscores to prevent path traversal.
  - [`validateImageDataUrl(dataUrl, maxSizeBytes)`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/lib/security.js#L38-L65): Validates Base64 image headers against `image/jpeg`, `image/png`, and `image/webp` MIME types and caps size at 10 MB.

### 3.4 HTTP Security Headers (`next.config.js`)
- **Control**: Applied globally to all routes via Next.js configuration:
  - `X-Frame-Options: DENY` (Prevents clickjacking).
  - `X-Content-Type-Options: nosniff` (Stops MIME-type sniffing).
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (Enforces HTTPS for 2 years).
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - `Content-Security-Policy`: Restricts scripts, styles, fonts, images (`https://drive.google.com`), and frame ancestors (`'none'`).

---

## 4. Key Security Vulnerabilities & Risk Register

| Risk ID | Vulnerability Description | Severity | Likelihood | Impact | Remediation Strategy |
|---|---|---|---|---|---|
| **SEC-01** | **Predictable Default PIN Fallbacks**: If environment variables are unset, default PINs (`111111`, `999999`) are active. | **HIGH** | High | Critical | Throw explicit server error at startup if `process.env.AUTH_PIN_*` is missing in production. |
| **SEC-02** | **Lack of Token-Based Sessions**: API routes require the plaintext 6-digit PIN sent in every request payload rather than an HTTP-only JWT session cookie. | **HIGH** | Medium | High | Implement HTTP-only JWT session cookies upon initial `/api/auth` verification. |
| **SEC-03** | **Unauthenticated Draft Read Access**: `GET /api/draft?inspectionId=...` returns draft data without validating role authorization. | **MEDIUM** | Medium | Medium | Require role session token or PIN on `GET /api/draft`. |
| **SEC-04** | **In-Memory Rate Limiting Serverless Bypass**: `lib/rateLimit.js` uses process-level `Map`, allowing brute force across multiple Vercel instances. | **MEDIUM** | High | Medium | Migrate rate limiter store to Redis or Upstash KV. |
| **SEC-05** | **Public Drive Image Exposure**: Uploaded photos are marked `role: "reader", type: "anyone"` on Google Drive to allow public display. | **LOW** | Low | Low | Serve images through authenticated API proxy or signed URLs. |
