# DAC Quality Score & Project Health Classification Model

## 1. Overview

The DAC Inspection Intelligence engine computes an empirical **Quality Score (0 – 100%)** and **Project Health Status** based strictly on real inspection data stored in the database.

---

## 2. Quality Score Mathematical Formula

$$\text{Quality Score} = \max\left(0, \min\left(100, W_{\text{pass}} + W_{\text{completion}} - P_{\text{defect}} - P_{\text{recheck}}\right)\right)$$

### Components & Weights:

1. **Pass Rate Component ($W_{\text{pass}}$)** — *Weight: 45%*
   $$W_{\text{pass}} = 45 \times \left( \frac{\text{Passed Checklist Items}}{\text{Passed Checklist Items} + \text{Failed Checklist Items}} \right)$$

2. **Completion Rate Component ($W_{\text{completion}}$)** — *Weight: 35%*
   $$W_{\text{completion}} = 35 \times \left( \frac{\text{Completed Inspections}}{\text{Total Project Inspections}} \right)$$

3. **Defect Density Penalty ($P_{\text{defect}}$)** — *Max Penalty: 12%*
   $$P_{\text{defect}} = \min\left(12, \frac{\text{Total Open Defects}}{\text{Total Project Inspections}} \times 4\right)$$

4. **Re-check Penalty ($P_{\text{recheck}}$)** — *Max Penalty: 8%*
   $$P_{\text{recheck}} = \min\left(8, \frac{\text{Re-check Required Inspections}}{\text{Total Project Inspections}} \times 6\right)$$

---

## 3. Project Health Classification Rules

Projects are automatically classified into three health tiers:

| Health Status | Classification Criteria | Recommended Action |
| :--- | :--- | :--- |
| **Healthy** | Quality Score $\ge 80\%$ AND Defect Density $< 2.0$ per inspection AND Rejections $= 0$ | Regular monitoring; ready for handover release. |
| **Needs Attention** | Quality Score $60\% \le S < 80\%$ OR Defect Density $2.0 \le D \le 4.0$ OR Re-checks $\ge 1$ | Priority site executive review and defect resolution. |
| **Critical** | Quality Score $< 60\%$ OR Defect Density $> 4.0$ per inspection OR Rejections $\ge 2$ | Escalation to GM – HUG & VP – HUG; pause handover. |

---

## 4. Risk Indicators & Thresholds

1. **High Defect Project**: Project with $> 5$ open defects per inspection.
2. **High Re-check Project**: Project with $\ge 20\%$ of inspections in `RECHECK_REQUIRED` state.
3. **Long Pending Approvals (SLA Breach)**: Approvals pending in any management stage for $> 3$ days (72 hours).
4. **Repeated Failed Items**: Specific checklist items failing across $> 25\%$ of inspected units.
5. **Ageing Inspections**: Active inspections un-updated for $> 5$ days.

---

## 5. Distinction Between Data, Calculation & Insight

- **DATA**: Raw values fetched directly from API (`passedCells: 42`, `failedCells: 8`).
- **CALCULATION**: Mathematical output of formula ($\text{Quality Score} = 81.5\%$).
- **INSIGHT**: Actionable operational prompt linked to exact record ID ("Site Engineer review pending for 4 days on Unit 302").
