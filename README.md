# DAC Joint Inspection & Key Handover

A digital enterprise version of the DAC Developers "Joint Inspection Checklist for Key Handover" paper form — inspection matrix, defect photo capture & storage, 8-stage sequential digital signatures, rejection & re-check loops, autosave, role-based approval portal, and executive PDF generation with an optional **Google Sheets / Drive** backend and zero-config local JSON fallback.

---

## Quick Start (Zero Config Demo Mode)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no Google Cloud credentials configured, the app automatically runs in **Demo Mode**:
- All drafts, submissions, approval events, signatures, and photos are written locally to `.data/inspections.json` and `.data/photos/`.
- The full end-to-end flow works immediately without any cloud setup.
- A "Demo mode · saving locally" status badge appears on the main interface.

---

## 8-Stage Sequential Approval Workflow

The application implements a strict sequential multi-signatory governance pipeline mirroring the DAC paper checklist:

```
[Start Inspection Form]
         │
         ▼
 1. Site Engineer (In-Charge sign-off & matrix completion)
         │
         ▼
 2. Customer (Owner sign-off)
         │
         ▼
 3. Technical Executive (Initial technical review)
         │
         ▼
 4. QA/QC In-Charge (Quality compliance sign-off)
         │
         ▼
 5. Project Manager (Project verification sign-off)
         │
         ▼
 6. Manager Technical (Technical management review)
         │
         ▼
 7. GM – HUG (General Manager sign-off)
         │
         ▼
 8. VP – HUG (Vice President final sign-off & completion)
```

- **Enforced Hierarchy**: Signatures must be submitted in strict sequential order. Out-of-order signature attempts are rejected by the backend.
- **Rejection & Re-Check Loops**: Any reviewer in stages 3–8 can reject an inspection with remarks, sending it back to the Site Engineer for rectification and re-inspection.
- **Admin Oversight**: Administrators can view all inspections across all stages, view the audit history, execute emergency administrative overrides, and export high-resolution printed inspection documents.

---

## Inspection Types

Every inspection requires selecting one of the 4 official inspection categories:
1. `INTERIOR JOINT INSPECTION`
2. `INTERIOR JOINT INSPECTION RE-CHECK`
3. `FINAL JOINT INSPECTION`
4. `FINAL JOINT INSPECTION RE-CHECK`

---

## Roles & Authentication

Authentication is role-based via 6-digit PINs configured in environment variables. In local demo mode, default fallback PINs are provided for local development.

| Role | Environment Variable | Permissions & Workflow Stage |
|---|---|---|
| **Start Inspection** | `AUTH_PIN_START_INSPECTION` | Unlocks new inspection form creation |
| **Site Engineer** | `AUTH_PIN_SITE_ENGINEER` | Stage 1 creator & initial sign-off |
| **Customer** | `AUTH_PIN_CUSTOMER` | Stage 2 customer verification sign-off |
| **Technical Executive** | `AUTH_PIN_TECHNICAL_EXECUTIVE` | Stage 3 technical review sign-off |
| **QA/QC In-Charge** | `AUTH_PIN_QAQC` | Stage 4 quality compliance sign-off |
| **Project Manager** | `AUTH_PIN_PROJECT_MANAGER` | Stage 5 project verification sign-off |
| **Manager Technical** | `AUTH_PIN_MANAGER_TECHNICAL` | Stage 6 technical management sign-off |
| **GM – HUG** | `AUTH_PIN_GM_HUG` | Stage 7 general manager sign-off |
| **VP – HUG** | `AUTH_PIN_VP_HUG` | Stage 8 final executive sign-off |
| **Admin** | `AUTH_PIN_ADMIN` | Full portal oversight & official PDF export |

> **Security Standards:**
> - PINs and passwords are never displayed in plaintext in the UI or client logs.
> - Role-based authorization is verified server-side on all state-changing endpoints (`/api/submit`, `/api/approval`, `/api/draft`).
> - Tamper-resistant HTTP-only session cookies ensure secure authenticated portal sessions.

---

## Google Sheets Backend Setup (Production)

To connect the application to Google Sheets and Google Drive for production data storage:

### 1. Google Sheets Architecture
The application uses 5 tabs in your Google Spreadsheet:
1. `Projects`: Contains project names and unit numbers for form dropdowns (`Project`, `Unit`).
2. `Inspections`: Primary inspection records, metadata, statuses, and checklist matrix data.
3. `ApprovalHistory`: Immutable chronological log of all approval, rejection, and signature events.
4. `Signatures`: Verified digital signature PNG data URLs with timestamps and role metadata.
5. `InspectionPhotos`: Captured defect photos with metadata and Drive file URLs.

*(Tabs are automatically verified and created by the application if they do not already exist).*

### 2. Service Account Setup
1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Sheets API** and **Google Drive API**.
3. Create a **Service Account**, generate a JSON key, and download it.
4. Share your Google Sheet and Google Drive target folder with the service account email (give **Editor** permissions).

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local` and set your credentials:

```bash
cp .env.example .env.local
```

Fill in the required variables (see `.env.example` for all configurable options):
- `GOOGLE_SHEETS_CLIENT_EMAIL`: Service account client email.
- `GOOGLE_SHEETS_PRIVATE_KEY`: Service account private key string (escaped `\n`).
- `GOOGLE_SHEET_ID`: Target Google Spreadsheet ID.
- `GOOGLE_DRIVE_FOLDER_ID`: (Optional) Google Drive folder ID for defect photo uploads.
- `SESSION_SECRET`: Random 32+ character string for signing session cookies.
- Role PIN overrides (`AUTH_PIN_*`).

---

## Running Tests

The test suite includes a comprehensive end-to-end test verifying all API routes, authentication mechanisms, 8-signature sequential approval flows, rejections, admin overrides, and security boundaries.

### Run Local E2E Test Suite:
```bash
# In terminal 1: Start local-mode server on port 3010
FORCE_LOCAL_MODE=true PORT=3010 npx next start -p 3010

# In terminal 2: Run the test suite
npm test
```

Or run directly via npm script:
```bash
npm run test:e2e
```

Refer to [`tests/README.md`](file:///d:/AUG-2026/dac-inspection-app%20(1)/tests/README.md) for detailed test documentation and standalone test utilities.

---

## Deployment on Vercel

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Import the repository into [Vercel](https://vercel.com).
3. In **Project Settings → Environment Variables**, add:
   - `GOOGLE_SHEETS_CLIENT_EMAIL`
   - `GOOGLE_SHEETS_PRIVATE_KEY`
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_DRIVE_FOLDER_ID`
   - `SESSION_SECRET`
   - Production `AUTH_PIN_*` variables
4. Deploy. Next.js App Router will build and deploy automatically.
