import fs from "node:fs/promises";
import type { TranscriptWord } from "@/lib/types";

function assTime(seconds: number) {
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  const cs = centiseconds % 100;
  const totalSeconds = Math.floor(centiseconds / 100);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

function escapeAss(text: string) {
  return text.replace(/[{}]/g, "").replace(/\n/g, " ");
}

function groupWords(words: TranscriptWord[]) {
  const groups: TranscriptWord[][] = [];
  let current: TranscriptWord[] = [];

  for (const word of words) {
    const previous = current.at(-1);
    const longPause = previous ? word.start - previous.end > 0.65 : false;
    const sentenceBreak = previous ? /[.!?]$/.test(previous.word.trim()) : false;

    if (current.length >= 7 || (current.length >= 3 && (longPause || sentenceBreak))) {
      groups.push(current);
      current = [];
    }

    current.push(word);
  }

  if (current.length > 0) groups.push(current);
  return groups;
}

function activeWordX(words: TranscriptWord[], index: number) {
  const clean = words.map((word) => escapeAss(word.word.trim()));
  const widths = clean.map((word) => Math.max(42, word.length * 31));
  const total = widths.reduce((sum, width) => sum + width, 0) + (words.length - 1) * 24;
  const left = 540 - total / 2;
  const offset = widths.slice(0, index).reduce((sum, width) => sum + width + 24, 0);
  return Math.round(left + offset + widths[index] / 2);
}

export async function writeAssSubtitles(words: TranscriptWord[], clipStart: number, filePath: string) {
  const relativeWords = words.map((word) => ({
    ...word,
    start: Math.max(0, word.start - clipStart),
    end: Math.max(0.05, word.end - clipStart)
  }));

  const events: string[] = [];

  for (const group of groupWords(relativeWords)) {
    const start = Math.max(0, group[0].start - 0.08);
    const end = group.at(-1)!.end + 0.15;
    const text = group.map((word) => escapeAss(word.word.trim())).join(" ");
    events.push(
      `Dialogue: 0,${assTime(start)},${assTime(end)},Base,,0,0,0,,{\\fad(80,80)\\an2\\pos(540,1535)}${text}`
    );

    group.forEach((word, index) => {
      const x = activeWordX(group, index);
      events.push(
        `Dialogue: 1,${assTime(word.start)},${assTime(word.end)},Active,,0,0,0,,{\\fad(35,35)\\fscx116\\fscy116\\an2\\pos(${x},1535)}${escapeAss(word.word.trim())}`
      );
    });
  }

  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Base,Arial,76,&H00FFFFFF,&H00FFFFFF,&H00000000,&H70000000,1,0,0,0,100,100,0,0,1,8,2,2,70,70,340,1
Style: Active,Arial,82,&H0000E7FF,&H0000E7FF,&H00000000,&H70000000,1,0,0,0,100,100,0,0,1,9,2,2,70,70,340,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;

  await fs.writeFile(filePath, ass, "utf8");
}
