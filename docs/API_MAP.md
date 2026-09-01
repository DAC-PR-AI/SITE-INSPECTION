# DAC Joint Inspection & Key Handover — API Map & Route Specifications

This document catalogs every HTTP endpoint in the Next.js App Router ([`app/api`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/app/api)).

---

## Endpoint Summary Table

| Method | Endpoint | File Location | Auth Required | Rate Limited | Primary Purpose |
|---|---|---|---|---|---|
| `POST` | `/api/auth` | [`app/api/auth/route.js`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/app/api/auth/route.js) | No (Public PIN check) | 5 / 15 min | Verify 6-digit role passcode |
| `GET` | `/api/projects` | [`app/api/projects/route.js`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/app/api/projects/route.js) | Public | No | Fetch master project & unit hierarchy |
| `GET` | `/api/draft` | [`app/api/draft/route.js`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/app/api/draft/route.js) | Public | No | Retrieve draft inspection by ID |
| `POST` | `/api/draft` | [`app/api/draft/route.js`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/app/api/draft/route.js) | Yes (Site Eng PIN) | 1000 / 15 min | Autosave draft inspection state |
| `POST` | `/api/submit` | [`app/api/submit/route.js`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/app/api/submit/route.js) | Yes (Site Eng PIN) | 5 / 15 min | Submit final inspection to workflow |
| `GET` | `/api/approval` | [`app/api/approval/route.js`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/app/api/approval/route.js) | Public (Role filtered) | No | List role-specific approval queue |
| `POST` | `/api/approval` | [`app/api/approval/route.js`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/app/api/approval/route.js) | Yes (Role PIN) | 5 / 15 min | Approve, reject, or sign inspection |
| `POST` | `/api/photos/upload` | [`app/api/photos/upload/route.js`](file:///d:/AUG-2026/dac-inspection-app%20%281%29/app/api/photos/upload/route.js) | Public | 20 / 15 min | Upload inspection image to Google Drive |

---

## Detailed Endpoint Specifications

### 1. `POST /api/auth`
Verifies a 6-digit PIN against environment variables or default fallback credentials using timing-safe comparisons.

- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "role": "Site Engineer",
    "pin": "272727"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "ok": true,
    "role": "Site Engineer",
    "roleId": "SITE_ENGINEER",
    "canSign": true
  }
  ```
- **Response Error Statuses**:
  - `400 Bad Request`: Missing role/pin or invalid JSON.
  - `401 Unauthorized`: Invalid credentials (generic message).
  - `429 Too Many Requests`: Exceeded 5 failed attempts within 15 minutes.

---

### 2. `GET /api/projects`
Retrieves the dictionary of projects and associated units from Google Sheets (`Projects` tab) or local fallback.

- **Request Headers**: None
- **Response `200 OK`**:
  ```json
  {
    "projects": {
      "DAC Aspire Heights": ["A-101", "A-102", "A-203"],
      "DAC Serene County": ["T1-01", "T1-02"]
    },
    "backend": "sheets"
  }
  ```

---

### 3. `GET /api/draft` & `POST /api/draft`

#### `GET /api/draft?inspectionId=...`
- **Query Parameter**: `inspectionId` (required)
- **Response `200 OK`**: `{ "data": { ...inspection }, "backend": "sheets" }`
- **Response `404 Not Found`**: `{ "error": "Inspection draft not found" }`

#### `POST /api/draft`
Autosaves in-progress inspection checklist data.

- **Request Body**:
  ```json
  {
    "inspectionId": "DAC-JIC-260827-4821",
    "projectName": "DAC Aspire Heights",
    "unitNumber": "A-101",
    "passcode": "272727",
    "cells": { ... }
  }
  ```
- **Response `200 OK`**: `{ "ok": true, "updatedAt": "2026-08-27T11:35:00.000Z", "backend": "sheets" }`
- **Response `413 Payload Too Large`**: Inspection payload exceeds Google Sheets chunk limits.

---

### 4. `POST /api/submit`
Submits a completed inspection, transition status to `QA_QC_PENDING`, and appends an audit record.

- **Request Body**: Inspection payload with `passcode: "272727"`.
- **Response `200 OK`**:
  ```json
  {
    "ok": true,
    "updatedAt": "2026-08-27T11:35:00.000Z",
    "backend": "sheets",
    "workflowStatus": "QA_QC_PENDING"
  }
  ```

---

### 5. `GET /api/approval` & `POST /api/approval`

#### `GET /api/approval`
- **Query Parameters**:
  - `role`: Role filter (`Site Engineer`, `QA/QC In-Charge`, `Project Manager`, `Manager Technical`, `GM – HUG`, `VP – HUG`, `Customer`, `Technical Executive`, `Admin`, `all_for_unit`).
  - `inspectionId`: Optional specific ID fetch.
  - `project`, `unit`: Used when `role=all_for_unit`.
- **Response `200 OK`**: `{ "inspections": [ { ... }, ... ] }`

#### `POST /api/approval`
Processes workflow stage transitions, parallel signatures, or rejections.

- **Request Body**:
  ```json
  {
    "inspectionId": "DAC-JIC-260827-4821",
    "role": "QA/QC In-Charge",
    "userName": "Mr. Ramesh QA",
    "action": "approve",
    "comments": "Inspected and verified.",
    "signature": "data:image/png;base64,...",
    "passcode": "202020"
  }
  ```
- **Validation Rules**:
  - Requires valid role password (`passcode`).
  - Enforces mandatory rejection remarks when `action: "reject"`.
  - Enforces prerequisite customer and technical executive signatures before stage advancement.
  - Checks state machine transition sequence (`REQUIRED_PREVIOUS_STATUS`).
- **Response `200 OK`**: `{ "ok": true, "workflowStatus": "PROJECT_MANAGER_PENDING", "inspection": { ... } }`

---

### 6. `POST /api/photos/upload`
Uploads JPEG/PNG/WEBP inspection photos to Google Drive under `/Project/Unit/`.

- **Request Body**:
  ```json
  {
    "inspectionId": "DAC-JIC-260827-4821",
    "photoType": "fail",
    "itemId": "3",
    "areaKey": "living",
    "project": "DAC Aspire Heights",
    "unit": "A-101",
    "dataUrl": "data:image/jpeg;base64,..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "ok": true,
    "url": "https://drive.google.com/uc?export=view&id=1abc...",
    "fileId": "1abc..."
  }
  ```
- **Fallback Response `200 OK`** (If Drive API fails or is unconfigured):
  ```json
  {
    "ok": true,
    "url": "data:image/jpeg;base64,...",
    "fileId": null,
    "fallback": true,
    "warning": "Drive upload failed"
  }
  ```
