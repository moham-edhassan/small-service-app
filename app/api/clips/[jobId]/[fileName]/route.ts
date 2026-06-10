import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { clipOutputDir } from "@/lib/paths";

export async function GET(request: Request, context: { params: Promise<{ jobId: string; fileName: string }> }) {
  const { jobId, fileName } = await context.params;
  const safeName = path.basename(fileName);
  const filePath = path.join(clipOutputDir(jobId), safeName);

  try {
    const data = await fs.readFile(filePath);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new NextResponse(data, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": download ? `attachment; filename="${safeName}"` : `inline; filename="${safeName}"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }
}
