import { NextResponse } from "next/server";
import { z } from "zod";
import { startProcessing } from "@/lib/pipeline";
import { ensureStorage, writeJob } from "@/lib/storage";
import type { JobRecord } from "@/lib/types";

const schema = z.object({
  url: z.string().url().refine((url) => /youtu\.be|youtube\.com/.test(url), "Enter a YouTube URL")
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  await ensureStorage();

  const now = new Date().toISOString();
  const job: JobRecord = {
    id: crypto.randomUUID(),
    url: parsed.data.url,
    status: "queued",
    step: "queued",
    progress: 0,
    message: "Queued",
    createdAt: now,
    updatedAt: now,
    clips: []
  };

  await writeJob(job);
  startProcessing(job.id, job.url);

  return NextResponse.json(job);
}
