import path from "node:path";
import { runCommand } from "@/lib/command";

function escapeFilterPath(filePath: string) {
  return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export async function cutSourceClip(source: string, start: number, duration: number, output: string) {
  await runCommand("ffmpeg", [
    "-y",
    "-ss",
    start.toFixed(3),
    "-i",
    source,
    "-t",
    duration.toFixed(3),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    output
  ]);
}

export async function reframeClip(input: string, output: string) {
  await runCommand("python3", [path.join(process.cwd(), "scripts", "reframe.py"), input, output]);
}

export async function burnSubtitles(input: string, subtitles: string, output: string) {
  await runCommand("ffmpeg", [
    "-y",
    "-i",
    input,
    "-vf",
    `subtitles='${escapeFilterPath(subtitles)}'`,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    output
  ]);
}
