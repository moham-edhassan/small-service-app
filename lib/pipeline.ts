import fs from "node:fs/promises";
import path from "node:path";
import { runCommand } from "@/lib/command";
import { clipOutputDir, jobTempDir } from "@/lib/paths";
import { ffprobeDuration } from "@/lib/probe";
import { burnSubtitles, cutSourceClip, reframeClip } from "@/lib/render";
import { patchJob, readJob } from "@/lib/storage";
import { writeAssSubtitles } from "@/lib/subtitles";
import { formatTimestampedTranscript, normalizeCandidate, transcriptDuration, wordsForRange } from "@/lib/transcript";
import type { CandidateClip, ClipResult, Transcript } from "@/lib/types";
import { scoreCandidate, selectCandidateWindows } from "@/lib/ollama";

const activeJobs = new Set<string>();

async function update(jobId: string, progress: number, message: string, step?: Parameters<typeof patchJob>[1]["step"]) {
  await patchJob(jobId, {
    status: step === "complete" ? "complete" : step === "failed" ? "failed" : "running",
    step,
    progress,
    message
  });
}

async function findDownloadedVideo(dir: string) {
  const files = await fs.readdir(dir);
  const video = files.find((file) => file.startsWith("source.") && /\.(mp4|mkv|webm|mov)$/i.test(file));
  if (!video) throw new Error("yt-dlp did not produce a video file");
  return path.join(dir, video);
}

async function downloadVideo(url: string, dir: string) {
  await runCommand("yt-dlp", [
    "--no-playlist",
    "-f",
    "bv*[height<=2160]+ba/b[height<=2160]/best",
    "--merge-output-format",
    "mp4",
    "-o",
    path.join(dir, "source.%(ext)s"),
    url
  ]);
  return findDownloadedVideo(dir);
}

async function extractAudio(source: string, audioPath: string) {
  await runCommand("ffmpeg", ["-y", "-i", source, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", audioPath]);
}

async function transcribe(audioPath: string, transcriptPath: string) {
  await runCommand("python3", [
    path.join(process.cwd(), "scripts", "transcribe.py"),
    audioPath,
    transcriptPath,
    process.env.WHISPER_MODEL || "large-v3"
  ]);
  const raw = await fs.readFile(transcriptPath, "utf8");
  return JSON.parse(raw) as Transcript;
}

function dedupeCandidates(candidates: CandidateClip[]) {
  const sorted = [...candidates].sort((a, b) => b.end - b.start - (a.end - a.start));
  const chosen: CandidateClip[] = [];

  for (const candidate of sorted) {
    const overlaps = chosen.some((clip) => Math.max(clip.start, candidate.start) < Math.min(clip.end, candidate.end));
    if (!overlaps) chosen.push(candidate);
  }

  return chosen.sort((a, b) => a.start - b.start);
}

async function detectClips(transcript: Transcript) {
  const rawSelection = await selectCandidateWindows(formatTimestampedTranscript(transcript), transcriptDuration(transcript));
  const candidates = rawSelection.clips
    .map((clip, index) => normalizeCandidate(transcript, clip, index))
    .filter((clip): clip is CandidateClip => Boolean(clip));

  const deduped = dedupeCandidates(candidates);
  const scored: CandidateClip[] = [];

  for (const candidate of deduped) {
    const result = await scoreCandidate(candidate);
    if (!result.keep || result.scores.final < 8) continue;
    scored.push({
      ...candidate,
      score: result.scores,
      metadata: {
        ...result.metadata,
        duration: Number((candidate.end - candidate.start).toFixed(1)),
        score: Number(result.scores.final.toFixed(1))
      }
    });
  }

  return scored.sort((a, b) => (b.score?.final || 0) - (a.score?.final || 0)).slice(0, 5);
}

async function renderClips(jobId: string, source: string, transcript: Transcript, candidates: CandidateClip[]) {
  const temp = jobTempDir(jobId);
  const out = clipOutputDir(jobId);
  await fs.mkdir(out, { recursive: true });

  const clips: ClipResult[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const clipId = `clip-${index + 1}`;
    const duration = candidate.end - candidate.start;
    const rawClip = path.join(temp, `${clipId}-source.mp4`);
    const reframedClip = path.join(temp, `${clipId}-vertical.mp4`);
    const subtitles = path.join(temp, `${clipId}.ass`);
    const fileName = `${clipId}.mp4`;
    const finalClip = path.join(out, fileName);

    await cutSourceClip(source, candidate.start, duration, rawClip);
    await reframeClip(rawClip, reframedClip);
    await writeAssSubtitles(wordsForRange(transcript, candidate.start, candidate.end), candidate.start, subtitles);
    await burnSubtitles(reframedClip, subtitles, finalClip);

    clips.push({
      id: clipId,
      start: candidate.start,
      end: candidate.end,
      duration: Number(duration.toFixed(1)),
      score: candidate.score!,
      metadata: candidate.metadata!,
      fileName,
      previewUrl: `/api/clips/${jobId}/${fileName}`,
      downloadUrl: `/api/clips/${jobId}/${fileName}?download=1`
    });

    const job = await readJob(jobId);
    if (job) await patchJob(jobId, { clips });
  }

  return clips;
}

export function startProcessing(jobId: string, url: string) {
  if (activeJobs.has(jobId)) return;
  activeJobs.add(jobId);

  void processJob(jobId, url).finally(() => {
    activeJobs.delete(jobId);
  });
}

async function processJob(jobId: string, url: string) {
  const temp = jobTempDir(jobId);

  try {
    await fs.mkdir(temp, { recursive: true });

    await update(jobId, 5, "Downloading video", "downloading");
    const source = await downloadVideo(url, temp);
    const sourceDuration = await ffprobeDuration(source);

    await update(jobId, 25, "Transcribing audio with Faster-Whisper", "transcribing");
    const audioPath = path.join(temp, "audio.wav");
    await extractAudio(source, audioPath);
    const transcript = await transcribe(audioPath, path.join(temp, "transcript.json"));
    transcript.duration = transcript.duration || sourceDuration;

    await update(jobId, 50, "Detecting and scoring standalone clips with Llama 3", "detecting");
    const candidates = await detectClips(transcript);
    if (candidates.length === 0) {
      throw new Error("No clips scored 8.0 or higher. Try a video with denser standalone moments.");
    }

    await update(jobId, 68, "Generating subtitles and vertical framing", "subtitles");
    await update(jobId, 74, "Rendering final MP4 clips", "rendering");
    const clips = await renderClips(jobId, source, transcript, candidates);

    await update(jobId, 96, "Cleaning temporary files", "cleaning");
    await fs.rm(temp, { recursive: true, force: true });

    await patchJob(jobId, {
      status: "complete",
      step: "complete",
      progress: 100,
      message: `Generated ${clips.length} excellent clip${clips.length === 1 ? "" : "s"}`,
      clips
    });
  } catch (error: unknown) {
    await fs.rm(temp, { recursive: true, force: true }).catch(() => {});
    await patchJob(jobId, {
      status: "failed",
      step: "failed",
      progress: 100,
      message: "Processing failed",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
