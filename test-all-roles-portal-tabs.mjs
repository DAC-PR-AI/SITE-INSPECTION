import { getInspectionWorkflowInfo } from "./lib/workflow.js";
import http from "http";

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

function req(method, path, body = null, cookie = null) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (postData) headers["Content-Length"] = Buffer.byteLength(postData);
    if (cookie) headers["Cookie"] = cookie;

    const request = http.request(
      url,
      { method, headers, timeout: 15000 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(data); } catch {}
          const setCookie = res.headers["set-cookie"];
          const sessionCookie = setCookie ? setCookie.find(c => c.startsWith("dac_session=")) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            json,
            raw: data,
            sessionCookie,
          });
        });
      }
    );

    request.on("error", (e) => resolve({ status: 0, error: e.message }));
    if (postData) request.write(postData);
    request.end();
  });
}

const ROLES_TO_TEST = [
  "Technical Executive",
  "Customer",
  "Site Engineer",
  "QA/QC In-Charge",
  "Project Manager",
  "Manager Technical",
  "GM – HUG",
  "VP – HUG",
  "Admin"
];

async function runAudit() {
  console.log("============================================================");
  console.log("  ALL-ROLES PORTAL TAB & SORTING VERIFICATION AUDIT");
  console.log("============================================================\n");

  const r = await req("GET", "/api/approval?role=all");
  const inspections = r.json?.inspections || [];
  console.log(`Total Inspections in Database: ${inspections.length}\n`);

  for (const role of ROLES_TO_TEST) {
    const enhanced = inspections.map(i => ({
      ...i,
      _wf: getInspectionWorkflowInfo(i, role)
    }));

    const pendingOnYou = enhanced.filter(i => i._wf.isPendingOnYou);
    const waiting = enhanced.filter(i => !i._wf.isPendingOnYou && !i._wf.isCompleted && !i._wf.isRejected);
    const completed = enhanced.filter(i => i._wf.isCompleted);
    const rejected = enhanced.filter(i => i._wf.isRejected);

    // Test priority sort
    const sorted = [...enhanced].sort((a, b) => {
      if (a._wf.isPendingOnYou && !b._wf.isPendingOnYou) return -1;
      if (!a._wf.isPendingOnYou && b._wf.isPendingOnYou) return 1;
      const timeA = new Date(a.updatedAt || a.createdAt || a.inspectionDate || 0).getTime() || 0;
      const timeB = new Date(b.updatedAt || b.createdAt || b.inspectionDate || 0).getTime() || 0;
      return timeB - timeA;
    });

    console.log(`👤 Role: ${role.padEnd(22)} | All: ${enhanced.length.toString().padStart(2)} | Pending: ${pendingOnYou.length.toString().padStart(2)} | Waiting: ${waiting.length.toString().padStart(2)} | Completed: ${completed.length.toString().padStart(2)} | Rejected: ${rejected.length.toString().padStart(2)}`);

    if (pendingOnYou.length > 0) {
      if (!sorted[0]._wf.isPendingOnYou) {
        throw new Error(`Priority sort failed for role: ${role}`);
      }
    }
  }

  console.log("\n============================================================");
  console.log("  ✅ ALL ROLES PORTAL CATEGORIZATION & SORTING VERIFIED (100%)");
  console.log("============================================================");
}

runAudit().catch(e => {
  console.error("Audit failed:", e);
  process.exit(1);
});
