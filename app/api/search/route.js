import { NextResponse } from "next/server";
import { getAllInspections, getProjects } from "../../../lib/store";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const [inspections, projects] = await Promise.all([
      getAllInspections(),
      getProjects(),
    ]);

    const results = [];

    // 1. Search Inspections & Customers & Statuses
    inspections.forEach((item) => {
      const idMatch = (item.inspectionId || "").toLowerCase().includes(q);
      const projMatch = (item.projectName || "").toLowerCase().includes(q);
      const unitMatch = (item.unitNumber || "").toLowerCase().includes(q);
      const custMatch = (item.customerName || "").toLowerCase().includes(q);
      const statusMatch = (item.workflowStatus || item.status || "").toLowerCase().includes(q);

      if (idMatch || projMatch || unitMatch || custMatch || statusMatch) {
        results.push({
          type: "Inspection",
          id: item.inspectionId,
          name: item.inspectionId,
          projectName: item.projectName || "N/A",
          unitNumber: item.unitNumber || "N/A",
          customerName: item.customerName || "N/A",
          status: item.workflowStatus || item.status || "DRAFT",
          currentStage: item.workflowStatus || item.status || "DRAFT",
          updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
          inspectionId: item.inspectionId,
        });
      }

      // Search Defects within Checklist Cells
      const cells = item.cells || {};
      Object.entries(cells).forEach(([cellKey, cell]) => {
        if (cell?.status === "fail") {
          const area = cell.area || cellKey;
          const remarks = (cell.remarks || "").toLowerCase();
          if (area.toLowerCase().includes(q) || remarks.includes(q)) {
            results.push({
              type: "Defect",
              id: `defect-${item.inspectionId}-${cellKey}`,
              name: `Defect: ${area}`,
              projectName: item.projectName || "N/A",
              unitNumber: item.unitNumber || "N/A",
              customerName: item.customerName || "N/A",
              status: "Open Defect",
              currentStage: item.workflowStatus || item.status || "DRAFT",
              updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
              inspectionId: item.inspectionId,
            });
          }
        }
      });
    });

    // 2. Search Projects
    Object.entries(projects).forEach(([projName, units]) => {
      if (projName.toLowerCase().includes(q)) {
        results.push({
          type: "Project",
          id: `proj-${projName}`,
          name: projName,
          projectName: projName,
          unitNumber: `All (${units.length} Units)`,
          customerName: "N/A",
          status: "Active Project",
          currentStage: "N/A",
          updatedAt: new Date().toISOString(),
        });
      }
    });

    return NextResponse.json({ results: results.slice(0, 30) });
  } catch (error) {
    console.error("[API/search] Error processing search query:", error);
    return NextResponse.json({ error: "Failed to execute search query" }, { status: 500 });
  }
}
