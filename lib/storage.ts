import fs from "node:fs/promises";
import { clipsDir, jobPath, jobsDir, outputDir, tempDir } from "@/lib/paths";
import type { JobRecord } from "@/lib/types";

export async function ensureStorage() {
  await Promise.all([
    fs.mkdir(outputDir, { recursive: true }),
    fs.mkdir(tempDir, { recursive: true }),
    fs.mkdir(jobsDir, { recursive: true }),
    fs.mkdir(clipsDir, { recursive: true })
  ]);
}

export async function readJob(jobId: string): Promise<JobRecord | null> {
  try {
    const raw = await fs.readFile(jobPath(jobId), "utf8");
    return JSON.parse(raw) as JobRecord;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeJob(job: JobRecord) {
  await ensureStorage();
  const updated: JobRecord = { ...job, updatedAt: new Date().toISOString() };
  await fs.writeFile(jobPath(job.id), JSON.stringify(updated, null, 2));
}

export async function patchJob(jobId: string, patch: Partial<JobRecord>) {
  const existing = await readJob(jobId);
  if (!existing) throw new Error(`Job ${jobId} does not exist`);
  await writeJob({ ...existing, ...patch });
}
