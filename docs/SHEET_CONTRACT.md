# FROZEN GOOGLE SHEET INTEGRATION CONTRACT

## 1. Overview & Operational Directive

> [!IMPORTANT]
> The existing Google Sheet structure is a working production contract and is **PERMANENTLY FROZEN**.
>
> Under no circumstances may the Google Sheet tabs, headers, columns, formulas, script rules, or sheet structure be modified, appended to, renamed, or migrated.
> The application must adapt to the existing Google Sheet contract.

---

## 2. Google Sheet Contract & Tab Specifications

### Tab 1: `Inspections`
Primary register storing core inspection state and chunked JSON payload.

| Column # | Header Name | Data Type | Description |
| :--- | :--- | :--- | :--- |
| **A** | `InspectionId` | String | Unique Inspection ID (e.g., `DAC-1001`) |
| **B** | `Project` | String | Project Name |
| **C** | `Unit` | String | Unit Number |
| **D** | `InspectionType` | String | Inspection Type |
| **E** | `CustomerName` | String | Handover Customer Name |
| **F** | `Date` | String | Inspection Date |
| **G** | `Time` | String | Inspection Time |
| **H** | `Status` | String | Workflow Status (`DRAFT`, `SITE_ENGINEER_PENDING`, `COMPLETED`, etc.) |
| **I** | `CompletionPct` | String | Overall completion percentage |
| **J** | `Passed` | Number | Count of passed items |
| **K** | `Failed` | Number | Count of failed items |
| **L** | `NA` | Number | Count of N/A items |
| **M** | `DeclarationChecked` | String | Declaration status |
| **N** | `UpdatedAt` | String | ISO Timestamp of last update |
| **O** | `SubmittedAt` | String | ISO Timestamp of initial submission |
| **P – AA** | `DataJSON_1` – `DataJSON_12` | String | Chunked JSON payload storing checklist cells, defects & metadata |

---

### Tab 2: `Projects`
Read-only project and unit roster register.

| Column # | Header Name | Data Type | Description |
| :--- | :--- | :--- | :--- |
| **A** | `Project` | String | Project Name |
| **B** | `UnitNumber` | String | Unit Number |
| **C** | `Status` | String | Project / Unit Status |

---

### Tab 3: `ApprovalHistory`
Audit history log for multi-tier workflow approvals.

| Column # | Header Name | Data Type | Description |
| :--- | :--- | :--- | :--- |
| **A** | `InspectionID` | String | Unique Inspection ID |
| **B** | `Project` | String | Project Name |
| **C** | `Unit` | String | Unit Number |
| **D** | `InspectionType` | String | Inspection Type |
| **E** | `Role` | String | Approver Role |
| **F** | `UserName` | String | Approver Name |
| **G** | `Action` | String | Action Taken (`approved`, `reject`, `recheck`) |
| **H** | `Status` | String | Post-action workflow status |
| **I** | `Comments` | String | Approver remarks / rejection reason |
| **J** | `Timestamp` | String | ISO Timestamp |
| **K** | `SignatureCaptured` | String | Boolean indicator |

---

### Tab 4: `Signatures`
Multi-role signature drawing stroke store.

| Column # | Header Name | Data Type | Description |
| :--- | :--- | :--- | :--- |
| **A** | `InspectionId` | String | Unique Inspection ID |
| **B** | `Role` | String | Signer Role (`Customer`, `Site Engineer`, etc.) |
| **C** | `SignerName` | String | Person Name |
| **D** | `Timestamp` | String | Signature Timestamp |
| **E – X** | `SigData_1` – `SigData_20` | String | Chunked Base64 PNG signature stroke data |

---

### Tab 5: `InspectionPhotos`
Photo attachment URL register.

| Column # | Header Name | Data Type | Description |
| :--- | :--- | :--- | :--- |
| **A** | `InspectionID` | String | Unique Inspection ID |
| **B** | `Project` | String | Project Name |
| **C** | `Unit` | String | Unit Number |
| **D** | `PhotoType` | String | Photo Type |
| **E** | `AreaKey` | String | Checklist Area Key |
| **F** | `ItemID` | String | Checklist Item ID |
| **G** | `PhotoURL` | String | Storage URL |
| **H** | `Timestamp` | String | ISO Timestamp |

---

## 3. Strict Adaptation Guidelines

1. **No Sheet Schema Changes**: Application logic computes derived fields in memory without altering Sheet structure.
2. **Customer Access Rule**: Customers do NOT log into the app; staff handle customer signatures on-site.
3. **Data Safety**: Read/write operations only; zero row deletion or formula mutation.
