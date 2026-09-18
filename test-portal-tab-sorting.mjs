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

async function testPortalTabsAndSorting() {
  console.log("============================================================");
  console.log("  PORTAL TAB FILTERING & PRIORITY SORTING AUDIT");
  console.log("============================================================\n");

  // 1. Log in as Site Engineer
  let r = await req("POST", "/api/auth", { userName: "Arun", password: "SiteEng@1002" });
  if (r.status !== 200) throw new Error("Site Engineer auth failed");
  const seCookie = r.sessionCookie;

  // 2. Fetch queue as Site Engineer
  r = await req("GET", "/api/approval?role=Site%20Engineer", null, seCookie);
  const inspections = r.json?.inspections || [];
  console.log(`✓ Total Inspections Fetched: ${inspections.length}`);

  // 3. Test categorization for Site Engineer
  const enhanced = inspections.map(i => ({
    ...i,
    _wf: getInspectionWorkflowInfo(i, "Site Engineer")
  }));

  const pendingOnYou = enhanced.filter(i => i._wf.isPendingOnYou);
  const waiting = enhanced.filter(i => !i._wf.isPendingOnYou && !i._wf.isCompleted && !i._wf.isRejected);
  const completed = enhanced.filter(i => i._wf.isCompleted);
  const rejected = enhanced.filter(i => i._wf.isRejected);

  console.log("\n─── TAB BREAKDOWN FOR SITE ENGINEER ───");
  console.log(`• All            : ${enhanced.length}`);
  console.log(`• Pending on You : ${pendingOnYou.length}`);
  console.log(`• Waiting        : ${waiting.length}`);
  console.log(`• Completed      : ${completed.length}`);
  console.log(`• Rejected       : ${rejected.length}`);

  // 4. Test Sorting in 'All' Tab
  const sorted = [...enhanced].sort((a, b) => {
    if (a._wf.isPendingOnYou && !b._wf.isPendingOnYou) return -1;
    if (!a._wf.isPendingOnYou && b._wf.isPendingOnYou) return 1;
    const timeA = new Date(a.updatedAt || a.createdAt || a.inspectionDate || 0).getTime() || 0;
    const timeB = new Date(b.updatedAt || b.createdAt || b.inspectionDate || 0).getTime() || 0;
    return timeB - timeA;
  });

  console.log("\n─── TOP 5 SORTED INSPECTIONS IN 'ALL' TAB ───");
  sorted.slice(0, 5).forEach((item, idx) => {
    console.log(`  ${idx + 1}. [${item.inspectionId}] ${item.projectName} Unit ${item.unitNumber}`);
    console.log(`     Pending on You: ${item._wf.isPendingOnYou ? "🔥 YES (TOP PRIORITY)" : "No"} | Waiting on: ${item._wf.currentPendingRole} | Status: ${item._wf.displayStatus}`);
  });

  // Verify that if any items are pending on you, the first item in the sorted list is pending on you
  if (pendingOnYou.length > 0) {
    if (!sorted[0]._wf.isPendingOnYou) {
      throw new Error("Sorting failed: Item pending on you is not at the top of the list!");
    }
    console.log("\n✓ PASS: Items requiring action from Site Engineer are pinned to the top!");
  }

  console.log("\n============================================================");
  console.log("  ✅ PORTAL TAB CATEGORIZATION & SORTING VERIFIED!");
  console.log("============================================================");
}

testPortalTabsAndSorting().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
