# DAC INTERNAL ROLE SECURITY & THREAT AUDIT SPECIFICATION

> [!IMPORTANT]
> **INTERNAL APPLICATION SECURITY ARCHITECTURE**
>
> The DAC Inspection & Key Handover application is strictly an internal enterprise platform.
> There is **NO customer login**, **NO customer account**, and **NO customer portal**.
> Customers interact strictly on-site during physical joint walkthroughs.

---

## 1. Verified Internal Staff Roles

The application strictly authenticates and authorizes 7 internal DAC personnel roles:

1. **`Site Engineer`** (`AUTH_PIN_SITE_ENGINEER`): On-site inspection lead.
2. **`QA/QC In-Charge`** (`AUTH_PIN_QAQC`): Quality assurance auditor.
3. **`Project Manager`** (`AUTH_PIN_PROJECT_MANAGER`): Execution manager.
4. **`Manager – Technical`** (`AUTH_PIN_MANAGER_TECHNICAL`): Technical compliance manager.
5. **`GM – HUG`** (`AUTH_PIN_GM_HUG`): General Manager – Handover Unit Group.
6. **`VP – HUG`** (`AUTH_PIN_VP_HUG`): Vice President – Handover Unit Group (Final approval authority).
7. **`Admin`** (`AUTH_PIN_ADMIN`): System Administrator (Dashboard, analytics, and override control).

---

## 2. Customer & Technical Executive Persona Definitions

### Customer Persona
- **Application User**: `NO` (Not a system login user).
- **Portal / Dashboard**: `NONE`.
- **Function**: Participates physically on-site during the joint walkthrough. Provides a physical digital signature on the staff member's device canvas during the spot signing session.

### Technical Executive Persona
- **Application User**: `YES` (Internal DAC staff user).
- **Function**: Conducts technical checks on-site and signs the spot signature alongside the Customer.

---

## 3. Security Threat Matrix & Verified Safeguards

| Threat Vector | Security Control Implemented | Enforced API / Module Location | Verification Result |
| :--- | :--- | :--- | :--- |
| **Unauthorized Approval** | Mandates 6-digit role passcode + IP Rate Limiter (5 attempts / 15 min window) | `app/api/auth/route.js`<br>`app/api/approval/route.js` | **`PASSED`** (Returns `401 Unauthorized`) |
| **Out-of-Order Approval** | Validates `canUserPerformAction()` against current workflow state token | `lib/workflow.js`<br>`app/api/approval/route.js` | **`PASSED`** (Returns `403 Forbidden`) |
| **Unauthorized Inspection Access** | Server-side role queue filtering (`GET /api/approval?role=...`) | `app/api/approval/route.js` | **`PASSED`** (Role-scoped output only) |
| **Unauthorized Export** | Strips credential secrets & PIN metadata from CSV payloads | `components/InternalReportCenter.jsx` | **`PASSED`** (Zero credential exposure) |
| **Unauthorized PDF Generation** | Requires role passcode verification before rendering official document | `components/JointInspectionPrintDoc.jsx` | **`PASSED`** (Protected document rendering) |
| **Unauthorized Sheet Operation** | Rejects direct UI mutations; all writes flow through `GoogleSheetAdapter` | `lib/GoogleSheetAdapter.js` | **`PASSED`** (Frozen Sheet contract preserved) |

---

## 4. Operational Principles

1. **Password Exposure Policy**: Passwords, PINs, and authentication secrets are NEVER logged, rendered in UI, or included in exported CSV/PDF documents.
2. **Sheet Immutability**: All security controls operate within application memory and server route middleware without altering the frozen Google Sheet structure.
