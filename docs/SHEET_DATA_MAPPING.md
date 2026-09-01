# DAC SHEET → APPLICATION DATA MAPPING CONTRACT

> [!IMPORTANT]
> **GOVERNING PRINCIPLE**
>
> *"The application should understand the Sheet. The Sheet should NOT be forced to understand the application."*
>
> All field mappings use exact frozen Google Sheet headers found during Mission 16. Zero headers have been created, modified, or renamed.

---

## 1. Tab-by-Tab Field Mapping Specifications

### 1.1 Tab: `Inspections`

| Frozen Sheet Header | Application Object Field | Target Type | Null / Invalid Fallback Rule |
| :--- | :--- | :--- | :--- |
| `InspectionId` | `inspectionId` | `ID` | `"DAC-UNKNOWN"` |
| `Project` | `projectName` | `STRING` | `"Default Project"` |
| `Unit` | `unitNumber` | `STRING` | `"000"` |
| `InspectionType` | `inspectionType` | `STRING` | `"INTERIOR JOINT INSPECTION"` |
| `CustomerName` | `customerName` | `STRING` | `"N/A"` |
| `Date` | `date` | `DATE` | Current ISO Date (`YYYY-MM-DD`) |
| `Time` | `time` | `TIME` | `"10:00 AM"` |
| `Status` | `workflowStatus` | `STATUS` | `"DRAFT"` |
| `CompletionPct` | `completionPct` | `PERCENT` | `"0%"` |
| `Passed` | `passedCount` | `NUMBER` | `0` |
| `Failed` | `failedCount` | `NUMBER` | `0` |
| `NA` | `naCount` | `NUMBER` | `0` |
| `DeclarationChecked` | `declarationChecked` | `BOOLEAN` | `false` |
| `UpdatedAt` | `updatedAt` | `ISODATE` | Current ISO Timestamp |
| `SubmittedAt` | `createdAt` | `ISODATE` | Current ISO Timestamp |
| `DataJSON_1..12` | `cells`, `signatures`, `defects` | `JSON_CHUNKS` | Reassembled in-memory object `{}` |

---

### 1.2 Tab: `Projects`

| Frozen Sheet Header | Application Object Field | Target Type | Null / Invalid Fallback Rule |
| :--- | :--- | :--- | :--- |
| `Project` | `projectName` | `STRING` | `"Default Project"` |
| `Unit` | `unitNumber` | `STRING` | `"000"` |

---

### 1.3 Tab: `ApprovalHistory`

| Frozen Sheet Header | Application Object Field | Target Type | Null / Invalid Fallback Rule |
| :--- | :--- | :--- | :--- |
| `InspectionID` | `inspectionId` | `ID` | `"DAC-UNKNOWN"` |
| `Project` | `projectName` | `STRING` | `"N/A"` |
| `Unit` | `unitNumber` | `STRING` | `"000"` |
| `InspectionType` | `inspectionType` | `STRING` | `"INTERIOR JOINT INSPECTION"` |
| `Role` | `role` | `STRING` | `"Approver"` |
| `UserName` | `userName` | `STRING` | `"Staff"` |
| `Action` | `action` | `STRING` | `"approved"` |
| `Status` | `status` | `STATUS` | `"SITE_ENGINEER_PENDING"` |
| `Comments` | `comments` | `STRING` | `""` |
| `Timestamp` | `timestamp` | `ISODATE` | Current ISO Timestamp |
| `SignatureCaptured` | `signatureCaptured` | `BOOLEAN` | `false` |

---

### 1.4 Tab: `Signatures`

| Frozen Sheet Header | Application Object Field | Target Type | Null / Invalid Fallback Rule |
| :--- | :--- | :--- | :--- |
| `InspectionId` | `inspectionId` | `ID` | `"DAC-UNKNOWN"` |
| `Role` | `role` | `STRING` | `"Customer"` |
| `SignerName` | `signerName` | `STRING` | `"Unknown Signer"` |
| `Timestamp` | `timestamp` | `ISODATE` | Current ISO Timestamp |
| `SigData_1..20` | `dataUrl` | `BASE64_CHUNKS` | Reassembled Base64 PNG stroke string |

---

### 1.5 Tab: `InspectionPhotos`

| Frozen Sheet Header | Application Object Field | Target Type | Null / Invalid Fallback Rule |
| :--- | :--- | :--- | :--- |
| `InspectionID` | `inspectionId` | `ID` | `"DAC-UNKNOWN"` |
| `Project` | `projectName` | `STRING` | `"N/A"` |
| `Unit` | `unitNumber` | `STRING` | `"N/A"` |
| `PhotoType` | `photoType` | `STRING` | `"general"` |
| `AreaKey` | `areaKey` | `STRING` | `"General"` |
| `ItemID` | `itemId` | `STRING` | `"Item"` |
| `PhotoURL` | `photoUrl` | `STRING` | `""` |
| `Timestamp` | `timestamp` | `ISODATE` | Current ISO Timestamp |

---

## 2. Type Coercion & Data Sanitization Rules

1. **Missing / Null Values**: Automatically coerced to documented fallback values without crashing application render loops.
2. **Boolean Normalization**: `"true"`, `"Yes"`, `"1"` evaluate to `true`; all other string representations evaluate to `false`.
3. **Number Coercion**: String integers (`"12"`) parsed via `parseInt(val, 10)`. Non-numeric values default to `0`.
4. **Status Normalization**: Transformed to uppercase underscored tokens (e.g. `"site engineer pending"` $\rightarrow$ `"SITE_ENGINEER_PENDING"`).
