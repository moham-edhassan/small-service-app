export type JobStatus = "queued" | "running" | "complete" | "failed";

export type JobStep =
  | "queued"
  | "downloading"
  | "transcribing"
  | "detecting"
  | "subtitles"
  | "rendering"
  | "cleaning"
  | "complete"
  | "failed";

export type TranscriptWord = {
  word: string;
  start: number;
  end: number;
  probability?: number;
};

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
};

export type Transcript = {
  language?: string;
  duration: number;
  segments: TranscriptSegment[];
};

export type ClipScore = {
  hookStrength: number;
  informationValue: number;
  emotionalImpact: number;
  storyCompleteness: number;
  engagementPotential: number;
  final: number;
};

export type ClipMetadata = {
  title: string;
  hook: string;
  duration: number;
  score: number;
  keywords: string[];
  caption: string;
};

export type ClipResult = {
  id: string;
  start: number;
  end: number;
  duration: number;
  score: ClipScore;
  metadata: ClipMetadata;
  fileName: string;
  previewUrl: string;
  downloadUrl: string;
};

export type JobRecord = {
  id: string;
  url: string;
  status: JobStatus;
  step: JobStep;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
  clips: ClipResult[];
};

export type CandidateClip = {
  id: string;
  start: number;
  end: number;
  reason: string;
  transcript: string;
  score?: ClipScore;
  metadata?: ClipMetadata;
};
