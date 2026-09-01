# DAC Approval SLA & Ageing Engine Specification

## 1. Configurable SLA Thresholds by Stage

The DAC Approval SLA engine establishes target response times (in hours) for each sequential management stage:

| Stage Role | Stage Key | Configured SLA Limit | Warning Threshold (50%) |
| :--- | :--- | :--- | :--- |
| **Site Engineer** | `SITE_ENGINEER_PENDING` | 24 Hours (1 Day) | 12 Hours |
| **QA / QC In-Charge** | `QA_QC_PENDING` | 24 Hours (1 Day) | 12 Hours |
| **Project Manager** | `PROJECT_MANAGER_PENDING` | 48 Hours (2 Days) | 24 Hours |
| **Manager – Technical** | `MANAGER_TECHNICAL_PENDING` | 48 Hours (2 Days) | 24 Hours |
| **GM – HUG** | `GM_HUG_PENDING` | 72 Hours (3 Days) | 36 Hours |
| **VP – HUG** | `VP_HUG_PENDING` | 72 Hours (3 Days) | 36 Hours |

---

## 2. Ageing Classification Rules

Ageing status is computed relative to the stage start timestamp ($\Delta t = t_{\text{current}} - t_{\text{stage\_start}}$):

1. **`New`**: $\Delta t < 0.50 \times \text{SLA}_{\text{stage}}$
   - Inspection is fresh and well within standard processing window.
2. **`Approaching SLA`**: $0.50 \times \text{SLA}_{\text{stage}} \le \Delta t \le \text{SLA}_{\text{stage}}$
   - Inspection requires attention; warning badge displayed.
3. **`SLA Breached`**: $\Delta t > \text{SLA}_{\text{stage}}$
   - Inspection has exceeded configured turnaround window; red escalation alert triggered.

---

## 3. Modular Notification Event Payload

When an SLA breach is detected, an event payload is queued in `lib/slaNotifications.js` for future notification integration:

```json
{
  "eventId": "SLA-EVT-1756279900",
  "inspectionId": "DAC-1002",
  "projectName": "DAC Sunset Heights",
  "unitNumber": "A-302",
  "stage": "QA_QC_PENDING",
  "role": "QA/QC In-Charge",
  "elapsedHours": 38.5,
  "slaLimitHours": 24,
  "overdueHours": 14.5,
  "status": "SLA_BREACHED",
  "triggeredAt": "2026-08-27T12:43:00.000Z"
}
```
