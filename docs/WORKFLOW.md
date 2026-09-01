# DAC OFFICIAL INTERNAL INSPECTION & APPROVAL WORKFLOW

> [!IMPORTANT]
> **INTERNAL EMPLOYEE APPLICATION ARCHITECTURE**
>
> The DAC Inspection & Key Handover application is designed exclusively for DAC internal staff.
> There is **NO customer login**, **NO customer portal**, and **NO customer dashboard**.
> Customers participate physically during the joint on-site inspection and provide spot signatures via the staff interface.

---

## 1. Official 8-Stage Business Workflow Sequence

```
CUSTOMER + TECHNICAL EXECUTIVE (On-site Spot Signatures)
        ↓
   SPOT SIGNATURES COMPLETE GATE
        ↓
SITE ENGINEER (Review / Sign-off / Reject / Re-check)
        ↓
QA / QC IN-CHARGE (Review / Sign-off / Reject / Re-check)
        ↓
PROJECT MANAGER (Review / Sign-off / Reject / Re-check)
        ↓
MANAGER – TECHNICAL (Review / Sign-off / Reject / Re-check)
        ↓
GM – HUG (Review / Sign-off / Reject / Re-check)
        ↓
VP – HUG (Final Review / Sign-off / Reject / Re-check)
        ↓
COMPLETED
```

---

## 2. Spot Signature Gate Rules

1. **Parallel Spot Signing**: Customer and Technical Executive sign at the spot during the physical joint inspection session.
2. **Sequential Approval Gate**: Internal management approvals (`Site Engineer` through `VP – HUG`) are **BLOCKED** until **BOTH** `Customer` and `Technical Executive` spot signatures are captured and locked.
3. **No Customer User Account**: Staff members facilitate on-site customer signature capture on digital drawing pads without exposing internal credentials or workflow controls.

---

## 3. Workflow State Mapping to Frozen Google Sheet Schema

Workflow states are stored in Column H (`Status`) of the frozen `Inspections` tab and Column H (`Status`) of `ApprovalHistory` tab:

| Workflow State Token | Visual Stage Label | Role Authorized to Transition |
| :--- | :--- | :--- |
| `DRAFT` | Draft Inspection | Staff Member |
| `SPOT_SIGNATURE_PENDING` | Spot Signatures Pending | Customer & Technical Executive (On-site) |
| `SPOT_SIGNATURE_COMPLETED` | Spot Signatures Complete | System Gate Check |
| `SITE_ENGINEER_PENDING` | Site Engineer Review | Site Engineer |
| `QA_QC_PENDING` | QA / QC In-Charge Review | QA / QC In-Charge |
| `PROJECT_MANAGER_PENDING` | Project Manager Review | Project Manager |
| `MANAGER_TECHNICAL_PENDING` | Manager – Technical Review | Manager Technical |
| `GM_HUG_PENDING` | GM – HUG Review | GM – HUG |
| `VP_HUG_PENDING` | VP – HUG Final Review | VP – HUG |
| `COMPLETED` | Fully Approved & Handover Released | System Final State |
| `REJECTED` | Stage Rejected | Current Stage Approver |
| `RECHECK_REQUIRED` | Correction Requested | Current Stage Approver |

---

## 4. Rejection & Re-Check Rules

- **Rejection**: Sets status to `REJECTED`, requires mandatory comment reason, and logs a permanent audit entry in `ApprovalHistory`.
- **Re-check**: Sets status to `RECHECK_REQUIRED`, returns inspection to correction stage without erasing previous signatures, approvals, comments, photos, or audit history.
