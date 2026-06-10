#!/usr/bin/env python3
import json
import sys
from pathlib import Path

from faster_whisper import WhisperModel


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("Usage: transcribe.py <audio.wav> <output.json> [model]")

    audio_path = sys.argv[1]
    output_path = Path(sys.argv[2])
    model_name = sys.argv[3] if len(sys.argv) > 3 else "large-v3"

    device = "auto"
    compute_type = "auto"
    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        vad_filter=True,
        word_timestamps=True,
        condition_on_previous_text=False,
        temperature=0.0,
    )

    output_segments = []
    duration = 0.0

    for segment in segments:
        words = []
        for word in segment.words or []:
            token = word.word.strip()
            if not token:
                continue
            words.append(
                {
                    "word": token,
                    "start": float(word.start),
                    "end": float(word.end),
                    "probability": float(word.probability),
                }
            )

        if words:
            duration = max(duration, words[-1]["end"])

        output_segments.append(
            {
                "start": float(segment.start),
                "end": float(segment.end),
                "text": segment.text.strip(),
                "words": words,
            }
        )

    output = {
        "language": info.language,
        "duration": duration,
        "segments": output_segments,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
