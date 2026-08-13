import { NextResponse } from "next/server";
import { upsertInspection, backendName } from "../../../lib/store";

export async function POST(request) {
  try {
    const data = await request.json();
    if (!data.inspectionId) {
      return NextResponse.json({ error: "inspectionId is required" }, { status: 400 });
    }

    const now = new Date();
    const timestampStr = `${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const initialAuditRecord = {
      id: Math.random().toString(36).substring(2, 9),
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

    const updatedData = {
      ...data,
      inspectionType: data.inspectionType || "IJI",
      workflowStatus: "QA_QC_PENDING",
      status: "submitted",
      approvalHistory,
      latestAuditRecord: initialAuditRecord,
    };

    const result = await upsertInspection(updatedData, { submitting: true });
    return NextResponse.json({ ...result, backend: backendName, workflowStatus: "QA_QC_PENDING" });
  } catch (err) {
    const status = err.code === "PAYLOAD_TOO_LARGE" ? 413 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
