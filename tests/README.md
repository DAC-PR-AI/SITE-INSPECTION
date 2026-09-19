# DAC Inspection App — Test Suite Documentation

This directory contains automated integration and end-to-end tests for the DAC Inspection App.

---

## 1. Running the Full E2E Test Suite Locally

The tests run in isolated **Local Mode** against a locally running server instance (zero external cloud dependencies).

### Step 1: Start the Local Mode Server

Start an isolated server instance on port `3010` with local fallback enabled:

**Linux / macOS / Bash:**
```bash
PORT=3010 FORCE_LOCAL_MODE=true npm run start
```

**Windows PowerShell:**
```powershell
$env:PORT="3010"; $env:FORCE_LOCAL_MODE="true"; npm run start
```

### Step 2: Run the Test Suite

In a separate terminal, execute:

```bash
npm test
```
*(Or specify custom target URL: `TEST_URL=http://localhost:3010 npm run test:e2e`)*

---

## 2. Test Coverage Overview

| Test Module | Coverage Scope |
| :--- | :--- |
| **`tests/full-e2e.mjs`** | Comprehensive single-command E2E suite: Pages, Static Assets, Authentication, Rate Limiting, Lockouts, Draft Saves & Redactions, Photo Uploads, 8-Role Signature Pipeline, Rejection / Recheck Loops, and Admin Overrides. |
| **`tests/regression-test.mjs`** | Regression checks across all role PINs, security boundaries, and input validation. |
| **`tests/security-audit-test.mjs`** | Session hijacking, cookie HMAC tampering, and XSS sanitization checks. |
| **`tests/stress-test.mjs`** | High-concurrency load and rate limit resilience testing. |

---

## 3. Environment Variables for Testing

Credentials can be overridden for custom test environments via environment variables:

```bash
TEST_URL=http://localhost:3010
TEST_PIN_CUSTOMER=111111
TEST_PIN_TECH_EXEC=444444
TEST_PIN_SITE_ENGINEER=272727
TEST_PIN_QAQC=202020
TEST_PIN_PM=303030
TEST_PIN_MAN_TECH=454545
TEST_PIN_GM=404040
TEST_PIN_VP=505050
TEST_PIN_ADMIN=999999
```
