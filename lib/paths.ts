import path from "node:path";

export const rootDir = process.cwd();
export const outputDir = path.join(rootDir, "output");
export const tempDir = path.join(rootDir, "temp");
export const jobsDir = path.join(outputDir, "jobs");
export const clipsDir = path.join(outputDir, "clips");

export function jobPath(jobId: string) {
  return path.join(jobsDir, `${jobId}.json`);
}

export function jobTempDir(jobId: string) {
  return path.join(tempDir, jobId);
}

export function clipOutputDir(jobId: string) {
  return path.join(clipsDir, jobId);
}
