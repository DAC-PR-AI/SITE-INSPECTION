import { NextResponse } from "next/server";
import { getProjects, backendName } from "../../../lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json({ projects, backend: backendName });
  } catch (err) {
    console.error("[projects] GET error:", err);
    // Emergency seed projects fallback so dropdown never fails
    return NextResponse.json({
      projects: {
        "DAC Aspire Heights": ["A-101", "A-102", "A-203", "B-201", "B-202", "B-305"],
        "DAC Serene County": ["T1-01", "T1-02", "T2-01", "T2-04"],
        "DAC Elan Grande": ["G-301", "G-302", "G-401", "G-402"],
      },
      backend: "fallback",
    });
  }
}
