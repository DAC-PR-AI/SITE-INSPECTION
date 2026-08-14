# DAC Joint Inspection & Key Handover

A digital version of the DAC Developers "Joint Inspection Checklist for Key
Handover" paper form — inspection matrix, fail-item photo capture, digital
signatures, and autosave — with an optional **Google Sheet** backend, ready
to deploy on **Vercel**.

Every inspection is one row in a "Inspections" sheet tab (all matrix data,
notes, and signatures stored as a JSON blob split across a few columns);
project/unit options come from a "Projects" tab you control.

## Quick start (zero config)

```bash
npm install
npm run dev
```

Open http://localhost:3000 — that's it. With no Google credentials set, the
app automatically runs in **demo mode**: every draft/submit is written to a
local `.data/inspections.json` file instead of a Google Sheet, so the whole
flow (project picker → matrix → photos → signatures → submit → resume) works
immediately with no cloud setup. This is also what makes the project runnable
as-is inside an IDE or agentic coding tool such as **Google Antigravity**, a
sandbox, or any CI preview — just install and run.

A small "Demo mode · saving locally" badge appears under the start form so
it's always clear which backend is active. Once you add the three
`GOOGLE_SHEETS_*` env vars below, the app switches to the Google Sheets
backend automatically — no code changes required — and the badge switches to
"Connected · Google Sheets".

---

## 1. (Optional) Create the Google Sheet, for a real production backend

1. Create a new Google Sheet (anywhere in your Drive).
2. Rename **Sheet1** to `Projects` and add two header columns:

   | Project | Unit |
   |---|---|
   | DAC Aspire Heights | A-101 |
   | DAC Aspire Heights | A-102 |
   | DAC Serene County | T1-01 |

   Add one row per project + unit combination. This is what powers the
   searchable project dropdown and dependent unit dropdown — edit it anytime,
   no redeploy needed.

3. You do **not** need to create the `Inspections` tab — the app creates it
   automatically (with headers) the first time it saves a draft.

4. Copy the **Sheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

---

## 2. Create a Google service account (so the app can read/write the sheet)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) →
   create (or pick) a project.
2. **APIs & Services → Library** → enable the **Google Sheets API**.
3. **APIs & Services → Credentials → Create Credentials → Service account**.
   Give it any name (e.g. `dac-inspection-app`).
4. Open the new service account → **Keys → Add Key → Create new key → JSON**.
   A JSON file downloads — you need two values from it:
   - `client_email`
   - `private_key`
5. Open your Google Sheet → **Share** → paste the `client_email` address →
   give it **Editor** access.

---

## 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```
GOOGLE_SHEETS_CLIENT_EMAIL=dac-inspection-app@your-project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIExampleKeyContent...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
```

Keep the `\n` sequences in the private key literally as written (the code
converts them back into real newlines).

---

## 4. Run it locally with the Sheets backend

```bash
npm install
npm run dev
```

Open http://localhost:3000. Pick a project + unit from your sheet, run
through an inspection, and check the `Inspections` tab in Google Sheets —
a row should appear (and update live as you fill the form in). The badge on
the start screen will read "Connected · Google Sheets".

---

## 5. Deploy to Vercel

1. Push this project to a GitHub/GitLab/Bitbucket repo.
2. In [Vercel](https://vercel.com), **Add New → Project** → import that repo.
3. Vercel auto-detects Next.js — no build settings to change.
4. Before deploying, go to **Settings → Environment Variables** and add the
   same three variables from step 3 (`GOOGLE_SHEETS_CLIENT_EMAIL`,
   `GOOGLE_SHEETS_PRIVATE_KEY`, `GOOGLE_SHEET_ID`) for **Production** and
   **Preview**. You can paste the private key with real line breaks or with
   `\n` — both work.
5. Deploy. Your app is live at `your-project.vercel.app`.

---

---

## Inspection Types

Every inspection requires selecting one of the 4 official inspection types before choosing a project and unit:
1. `INTERIOR JOINT INSPECTION`
2. `INTERIOR JOINT INSPECTION RE-CHECK`
3. `FINAL JOINT INSPECTION`
4. `FINAL JOINT INSPECTION RE-CHECK`

This inspection type is stored directly on the Google Sheet / local database, displayed throughout the workflow, and dynamically injected into the official printed checklist header and customer declaration.

---

## Roles & 6-Digit Password Authentication

Each role authenticates using a dedicated 6-digit password. In production, configure these via environment variables. In local zero-config demo mode, the following documented default PINs are active:

| Role / Action | Environment Variable | Default Demo PIN | Role Scope / Permissions |
|---|---|---|---|
| **Start Inspection** | `AUTH_PIN_START_INSPECTION` | `272727` | Unlocks new inspection start form |
| **Site Engineer** | `AUTH_PIN_SITE_ENGINEER` | `272727` | Inspection In-Charge sign-off & portal |
| **Customer** | `AUTH_PIN_CUSTOMER` | `111111` | Flat/Villa Owner sign-off |
| **QA/QC In-Charge** | `AUTH_PIN_QAQC` | `202020` | Quality & compliance stage approval |
| **Project Manager** | `AUTH_PIN_PROJECT_MANAGER` | `303030` | Project verification stage approval |
| **Technical Executive** | `AUTH_PIN_TECHNICAL_EXECUTIVE` | `444444` | Technical review parallel sign-off |
| **Manager Technical** | `AUTH_PIN_MANAGER_TECHNICAL` | `454545` | Technical management sign-off |
| **GM – HUG** | `AUTH_PIN_GM_HUG` | `404040` | General Manager approval |
| **VP – HUG** | `AUTH_PIN_VP_HUG` | `505050` | Vice President final completion sign-off |
| **Admin** | `AUTH_PIN_ADMIN` | `999999` | Complete oversight across all inspections & exclusive Print/PDF export |

> **Security & Privacy Rules:**
> - Passwords are **never displayed in plaintext anywhere in the UI** (masked `••••••` input only, no show password toggles, no plaintext in logs or exported documents).
> - Each signature box strictly verifies the 6-digit password for that specific role and locks upon signing.

---

## Admin Oversight & Exclusive Print/PDF Generation

- **Full Oversight View**: Admin can log in using the 6-digit Admin PIN to view **all inspections across all stages** (Drafts, In Progress, QA/QC, PM, GM, VP, Completed, Rejected).
- **Full Detail Inspection**: Admin can inspect the full matrix, defect remarks, photos, and signatures collected so far.
- **Exclusive Print / PDF Export**: Only the Admin role can trigger the official print layout and PDF generation from the portal oversight view. Admin does not sign individual inspection boxes.

---

## Backend switching

`lib/store.js` is the only thing the API routes import from. It checks for
`GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`, and
`GOOGLE_SHEET_ID` and:

- **all three present** → uses `lib/sheets.js` (Google Sheets backend).
- **any missing** → uses `lib/localStore.js` (a JSON file at
  `.data/inspections.json`, gitignored) — the zero-config demo backend.

## How data flows

- **Landing screen** — `GET /api/projects` reads the `Projects` tab to
  populate the project/unit dropdowns.
- **Autosave** — every change debounces a `POST /api/draft`, which
  upserts one row per `inspectionId` in the `Inspections` tab (status
  `draft`).
- **Resume Draft** — enter an Inspection ID and `GET /api/draft` looks up
  that row and reloads the full form state (matrix answers, photos,
  signatures included).
- **Approval Portal** — `GET /api/approval` retrieves queues and `POST /api/approval`
  advances stages or captures verified digital signatures.
- **Auth Verification** — `POST /api/auth` verifies role 6-digit passwords securely.

