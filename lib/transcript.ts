import type { CandidateClip, Transcript, TranscriptWord } from "@/lib/types";

export function allWords(transcript: Transcript) {
  return transcript.segments.flatMap((segment) => segment.words);
}

export function transcriptDuration(transcript: Transcript) {
  const words = allWords(transcript);
  return words.at(-1)?.end || transcript.duration || 0;
}

export function formatTimestampedTranscript(transcript: Transcript) {
  return transcript.segments
    .map((segment) => `[${segment.start.toFixed(1)}-${segment.end.toFixed(1)}] ${segment.text.trim()}`)
    .join("\n");
}

export function wordsForRange(transcript: Transcript, start: number, end: number) {
  return allWords(transcript).filter((word) => word.end >= start && word.start <= end);
}

export function textForRange(transcript: Transcript, start: number, end: number) {
  return wordsForRange(transcript, start, end)
    .map((word) => word.word)
    .join(" ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function nearestWordStart(words: TranscriptWord[], target: number, direction: "before" | "after") {
  const eligible =
    direction === "before" ? words.filter((word) => word.start <= target) : words.filter((word) => word.start >= target);
  if (eligible.length === 0) return target;
  return eligible.reduce((best, word) =>
    Math.abs(word.start - target) < Math.abs(best.start - target) ? word : best
  ).start;
}

function nearestSentenceEnd(words: TranscriptWord[], target: number) {
  const nearby = words.filter((word) => word.end >= target - 5 && word.end <= target + 8);
  const punctuated = nearby.find((word) => /[.!?]$/.test(word.word.trim()));
  return punctuated?.end || target;
}

export function normalizeCandidate(transcript: Transcript, raw: { start: number; end: number; reason: string }, index: number) {
  const words = allWords(transcript);
  const start = Math.max(0, nearestWordStart(words, raw.start, "after") - 0.15);
  const sentenceEnd = nearestSentenceEnd(words, raw.end);
  const end = Math.min(transcriptDuration(transcript), sentenceEnd + 0.25);
  const duration = end - start;

  if (duration < 30 || duration > 90) return null;

  const clip: CandidateClip = {
    id: `clip-${index + 1}`,
    start,
    end,
    reason: raw.reason,
    transcript: textForRange(transcript, start, end)
  };

  if (clip.transcript.split(/\s+/).length < 80) return null;
  return clip;
}
