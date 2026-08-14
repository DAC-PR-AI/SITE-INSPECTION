import { NextResponse } from "next/server";
import { upsertInspection, backendName } from "../../../lib/store";
import { verifyRolePassword } from "../../../lib/auth";
import { checkRateLimit, recordFailedAttempt, clearRateLimit, getClientIp } from "../../../lib/rateLimit";
import crypto from "crypto";

/**
 * /api/submit — Final submission of a completed inspection by Site Engineer.
 * Requires a valid Site Engineer 6-digit passcode.
 */
export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const data = await request.json();

    if (!data.inspectionId) {
      return NextResponse.json({ error: "inspectionId is required" }, { status: 400 });
    }

    // Rate limit
    const { limited, resetInMs } = checkRateLimit(ip, "SITE_ENGINEER");
    if (limited) {
      const minutes = Math.ceil(resetInMs / 60000);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${minutes} minute(s).` },
        { status: 429 }
      );
    }

    // Require Site Engineer passcode
    const passcode = data.passcode || "";
    const isValid = verifyRolePassword("Site Engineer", passcode);
    if (!isValid) {
      recordFailedAttempt(ip, "SITE_ENGINEER");
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    clearRateLimit(ip, "SITE_ENGINEER");

    const now = new Date();
    const timestampStr = `${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const initialAuditRecord = {
      id: crypto.randomUUID(),
      inspectionId: data.inspectionId,
      project: data.projectName || "",
      unit: data.unitNumber || "",
      inspectionType: data.inspectionType || "IJI",
      role: "Site Engineer",
      userName: data.siteEngineerName || "Site Engineer",
      action: "Submitted & Approved",
      status: "QA_QC_PENDING",
      comments: data.generalRemarks || "Initial inspection completed",
      timestamp: timestampStr,
      signature: data.signatures?.siteEngineer ? "Captured" : "None",
    };

    const approvalHistory = data.approvalHistory || [];
    if (!approvalHistory.some((a) => a.role === "Site Engineer" && a.action.includes("Submitted"))) {
      approvalHistory.push(initialAuditRecord);
    }

    // Strip passcode before storing
    const { passcode: _p, ...cleanData } = data;

    const updatedData = {
      ...cleanData,
      inspectionType: cleanData.inspectionType || "IJI",
      workflowStatus: "QA_QC_PENDING",
      status: "submitted",
      approvalHistory,
      latestAuditRecord: initialAuditRecord,
    };

    const result = await upsertInspection(updatedData, { submitting: true });
    return NextResponse.json({ ...result, backend: backendName, workflowStatus: "QA_QC_PENDING" });
  } catch (err) {
    console.error("[submit] POST error:", err);
    const status = err.code === "PAYLOAD_TOO_LARGE" ? 413 : 500;
    return NextResponse.json({ error: "Failed to submit inspection." }, { status });
  }
}
