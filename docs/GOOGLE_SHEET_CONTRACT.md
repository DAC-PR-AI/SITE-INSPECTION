# DAC GOOGLE SHEET COMPATIBILITY CONTRACT AUDIT

> [!IMPORTANT]
> **GOOGLE SHEET CONTRACT FROZEN**
>
> The existing Google Sheet structure is a working production contract.
> It MUST NOT be modified, redesigned, migrated, or re-schematized under any circumstances.

---

## 1. Sheet Tabs

The current Google Spreadsheet contains 5 official active tabs:

1. **`Inspections`**: Primary register storing core inspection state, progress metrics, and chunked JSON cell payloads.
2. **`Projects`**: Master catalog of projects and unit numbers.
3. **`ApprovalHistory`**: Multi-tier audit trail logging approval, rejection, and re-check actions.
4. **`Signatures`**: Multi-role digital signature stroke data store.
5. **`InspectionPhotos`**: Photo attachment URL registry.

---

## 2. Headers & Column Definitions

### Tab 1: `Inspections` (27 Columns: `A1:AA1`)
- **Base Headers (Columns 1–15 / `A–O`)**:
  - `InspectionId`, `Project`, `Unit`, `InspectionType`, `CustomerName`, `Date`, `Time`, `Status`, `CompletionPct`, `Passed`, `Failed`, `NA`, `DeclarationChecked`, `UpdatedAt`, `SubmittedAt`
- **JSON Chunk Headers (Columns 16–27 / `P–AA`)**:
  - `DataJSON_1`, `DataJSON_2`, `DataJSON_3`, `DataJSON_4`, `DataJSON_5`, `DataJSON_6`, `DataJSON_7`, `DataJSON_8`, `DataJSON_9`, `DataJSON_10`, `DataJSON_11`, `DataJSON_12`

### Tab 2: `Projects` (2 Columns: `A1:B1`)
- `Project`, `Unit`

### Tab 3: `ApprovalHistory` (11 Columns: `A1:K1`)
- `InspectionID`, `Project`, `Unit`, `InspectionType`, `Role`, `UserName`, `Action`, `Status`, `Comments`, `Timestamp`, `SignatureCaptured`

### Tab 4: `Signatures` (24 Columns: `A1:X1`)
- **Base Headers (Columns 1–4 / `A–D`)**: `InspectionId`, `Role`, `SignerName`, `Timestamp`
- **Signature Stroke Chunk Headers (Columns 5–24 / `E–X`)**: `SigData_1` through `SigData_20`

### Tab 5: `InspectionPhotos` (8 Columns: `A1:H1`)
- `InspectionID`, `Project`, `Unit`, `PhotoType`, `AreaKey`, `ItemID`, `PhotoURL`, `Timestamp`

---

## 3. Data Types

- **String**: `InspectionId`, `Project`, `Unit`, `InspectionType`, `CustomerName`, `Role`, `UserName`, `Action`, `Status`, `Comments`, `PhotoType`, `AreaKey`, `ItemID`, `PhotoURL`
- **Number / Numeric String**: `CompletionPct` ("85%"), `Passed` (integer), `Failed` (integer), `NA` (integer)
- **Boolean / String Flag**: `DeclarationChecked` ("true" / "false"), `SignatureCaptured` ("true" / "false")
- **ISO Timestamp**: `Date` ("YYYY-MM-DD"), `Time` ("HH:mm"), `UpdatedAt`, `SubmittedAt`, `Timestamp`
- **Chunked Base64 / String**: `DataJSON_1..12` (~45,000 chars per column), `SigData_1..20` (~20,000 chars per column)

---

## 4. Required Fields

- **For Inspections**: `InspectionId`, `Project`, `Unit`, `InspectionType`, `Status`
- **For Approvals**: `InspectionID`, `Role`, `UserName`, `Action`, `Status`, `Timestamp`
- **For Signatures**: `InspectionId`, `Role`, `SignerName`, `Timestamp`, `SigData_1`
- **For Photos**: `InspectionID`, `PhotoURL`, `Timestamp`

---

## 5. Optional Fields

- `CustomerName` (Handled on-site by staff)
- `Comments` / Rejection Remarks
- `DeclarationChecked`
- `PhotoType`, `AreaKey`, `ItemID`

---

## 6. Existing Formulas & Calculation Logic

- No Google Sheet cell formulas (`=SUM(...)`) are injected.
- All metrics (`Passed`, `Failed`, `NA`, `CompletionPct`) are computed in-memory by the application and written as RAW values to protect spreadsheet stability.

---

## 7. Existing IDs

- **Inspection ID Format**: `DAC-1001`, `DAC-1002`, `DAC-1003`
- **Project ID**: Project Name String (e.g. `DAC Sunset Heights`)
- **Unit ID**: Unit String (e.g. `A-302`)
- **Item / Cell Key**: Format `cell-{room}-{index}`

---

## 8. Existing Status Fields

- **Inspection Workflow Statuses**: `DRAFT`, `SPOT_SIGNATURE_PENDING`, `SPOT_SIGNATURE_COMPLETED`, `SITE_ENGINEER_PENDING`, `SITE_ENGINEER_APPROVED`, `QA_QC_PENDING`, `QA_QC_APPROVED`, `PROJECT_MANAGER_PENDING`, `PROJECT_MANAGER_APPROVED`, `MANAGER_TECHNICAL_PENDING`, `MANAGER_TECHNICAL_APPROVED`, `GM_HUG_PENDING`, `GM_HUG_APPROVED`, `VP_HUG_PENDING`, `COMPLETED`, `REJECTED`, `RECHECK_REQUIRED`
- **Approval Actions**: `approved`, `reject`, `recheck`, `signed`

---

## 9. Existing Inspection Fields

- `InspectionId`, `InspectionType`, `Passed`, `Failed`, `NA`, `CompletionPct`, `DeclarationChecked`, `UpdatedAt`, `SubmittedAt`, `DataJSON_1..12`

---

## 10. Existing Project & Unit Fields

- `Project` (Column A in `Projects` tab)
- `Unit` / `UnitNumber` (Column B in `Projects` tab)

---

## 11. Existing Signature Fields

- `InspectionId`, `Role` (`Customer`, `Technical Executive`, `Site Engineer`, `QA/QC In-Charge`, `Project Manager`, `Manager Technical`, `GM HUG`, `VP HUG`), `SignerName`, `Timestamp`, `SigData_1..20`

---

## 12. Existing Approval Fields

- `InspectionID`, `Project`, `Unit`, `InspectionType`, `Role`, `UserName`, `Action`, `Status`, `Comments`, `Timestamp`, `SignatureCaptured`

---

## 13. Existing Read Operations

- **`getProjects()`**: Reads range `Projects!A2:C`
- **`getAllInspections()`**: Reads range `Inspections!A2:AA`
- **`getInspection(inspectionId)`**: Reads matching row from `Inspections!A2:AA` and reassembles `DataJSON_1..12`
- **`getApprovalHistory(inspectionId)`**: Reads range `ApprovalHistory!A2:K`
- **`getSignatures(inspectionId)`**: Reads range `Signatures!A2:X` and reassembles stroke chunks

---

## 14. Existing Write Operations

- **`upsertInspection(data)`**: Searches `Inspections!A:A` for `InspectionId`. Updates existing row if found, else appends new row.
- **`appendApprovalHistory(record)`**: Appends row to `ApprovalHistory!A:K`.
- **`saveSignature(sigRecord)`**: Appends or updates row in `Signatures!A:X`.
- **`savePhoto(photoRecord)`**: Appends row to `InspectionPhotos!A:H`.

---

## Final Governance Status

**GOOGLE SHEET CONTRACT FROZEN**
