import { NextResponse } from "next/server";
import { getProjects, backendName } from "../../../lib/store";

export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json({ projects, backend: backendName });
  } catch (err) {
    return NextResponse.json({ error: err.message, backend: backendName }, { status: 500 });
  }
}
