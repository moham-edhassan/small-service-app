import type { CandidateClip, ClipMetadata, ClipScore } from "@/lib/types";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3:8b-instruct";

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error(`Ollama response did not contain JSON: ${text.slice(0, 500)}`);
  return candidate.slice(first, last + 1);
}

async function generateJson<T>(prompt: string): Promise<T> {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0.15,
        top_p: 0.85
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed (${response.status}). Is Ollama running and is ${OLLAMA_MODEL} pulled?`);
  }

  const data = (await response.json()) as { response: string };
  return JSON.parse(extractJson(data.response)) as T;
}

export async function selectCandidateWindows(transcript: string, maxDuration: number) {
  return generateJson<{ clips: Array<{ start: number; end: number; reason: string }> }>(`
You are an expert short-form video editor selecting only excellent standalone clips.

Video duration: ${maxDuration.toFixed(1)} seconds.

Rules:
- Select 2 to 8 candidate clips.
- Every candidate must be 30 to 90 seconds.
- Prefer 45 to 75 seconds.
- Do not cut mid-sentence, mid-story, or mid-thought.
- Select complete stories, lessons, strong opinions, emotional moments, educational insights, business insights, productivity tips, entrepreneurial advice, or surprising facts.
- Avoid candidates that need earlier context.

Return strict JSON:
{
  "clips": [
    { "start": 12.3, "end": 68.9, "reason": "why this is standalone and compelling" }
  ]
}

Timestamped transcript:
${transcript}
`);
}

export async function scoreCandidate(candidate: CandidateClip) {
  const result = await generateJson<{
    keep: boolean;
    scores: ClipScore;
    metadata: ClipMetadata;
    rejectionReason?: string;
  }>(`
Score this short-form clip candidate as a ruthless editor.

Clip duration: ${(candidate.end - candidate.start).toFixed(1)} seconds.
Candidate reason: ${candidate.reason}

Evaluate these categories from 1-10:
1. Hook Strength
2. Information Value
3. Emotional Impact
4. Story Completeness
5. Engagement Potential

Reject if it starts abruptly, ends abruptly, has excessive filler, depends on previous context, contains long silence, lacks a takeaway, or has weak engagement potential.
Only keep if final score is 8.0 or higher.

Return strict JSON:
{
  "keep": true,
  "scores": {
    "hookStrength": 9,
    "informationValue": 8,
    "emotionalImpact": 8,
    "storyCompleteness": 9,
    "engagementPotential": 8,
    "final": 8.4
  },
  "metadata": {
    "title": "Short punchy title",
    "hook": "Opening hook",
    "duration": 56.2,
    "score": 8.4,
    "keywords": ["keyword"],
    "caption": "Social caption with a clear takeaway"
  },
  "rejectionReason": ""
}

Transcript:
${candidate.transcript}
`);

  return result;
}
