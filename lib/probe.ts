import { captureCommand } from "@/lib/command";

export async function ffprobeDuration(filePath: string) {
  const raw = await captureCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath
  ]);
  const duration = Number.parseFloat(raw);
  if (!Number.isFinite(duration)) throw new Error(`Could not read duration from ${filePath}`);
  return duration;
}
