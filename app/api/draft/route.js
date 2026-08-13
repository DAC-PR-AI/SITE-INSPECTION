import { NextResponse } from "next/server";
import { upsertInspection, getInspection, backendName } from "../../../lib/store";

export async function POST(request) {
  try {
    const data = await request.json();
    if (!data.inspectionId) {
      return NextResponse.json({ error: "inspectionId is required" }, { status: 400 });
    }
    const result = await upsertInspection(data, { submitting: false });
    return NextResponse.json({ ...result, backend: backendName });
  } catch (err) {
    const status = err.code === "PAYLOAD_TOO_LARGE" ? 413 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const inspectionId = searchParams.get("inspectionId");
    if (!inspectionId) {
      return NextResponse.json({ error: "inspectionId is required" }, { status: 400 });
    }
    const data = await getInspection(inspectionId);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data, backend: backendName });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
