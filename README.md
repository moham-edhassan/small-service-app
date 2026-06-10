# Personal AI YouTube Shorts Generator

A local-first Next.js app that turns a YouTube video into a small set of high-quality vertical Shorts, TikToks, and Reels.

The app runs everything on your machine:

- `yt-dlp` downloads the source video.
- `ffmpeg` extracts audio and renders final H.264/AAC MP4 files.
- Faster-Whisper transcribes with word-level timestamps.
- Ollama runs Llama 3 8B Instruct for story-aware clip selection, scoring, and metadata.
- MediaPipe detects faces for smooth speaker-centered vertical reframing.
- ASS subtitles are burned into each final video with readable TikTok-style captions.

Outputs are written to `output/`. Temporary files are written to `temp/` and removed after processing.

## Requirements

- Node.js 20+
- Python 3.10 or 3.11
- FFmpeg
- yt-dlp
- Ollama
- Llama 3 8B Instruct pulled locally

On macOS:

```bash
brew install node ffmpeg yt-dlp ollama
ollama pull llama3:8b-instruct
```

Python dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Node dependencies:

```bash
npm install
```

Run Ollama:

```bash
ollama serve
```

Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

Environment variables:

```bash
WHISPER_MODEL=large-v3
OLLAMA_MODEL=llama3:8b-instruct
OLLAMA_URL=http://127.0.0.1:11434
```

For faster transcription on smaller machines, set `WHISPER_MODEL=medium` or `WHISPER_MODEL=small`. The default is `large-v3` for quality.

## Output

Each generated clip includes:

```json
{
  "title": "",
  "hook": "",
  "duration": 0,
  "score": 0,
  "keywords": [],
  "caption": ""
}
```

Final videos are exported as:

- 1080x1920
- MP4
- H.264
- AAC audio
- CRF 18
- Faststart enabled

## Docker

Build and run with Docker Compose:

```bash
docker compose up --build
```

The Compose file includes an Ollama service. Pull the model inside the Ollama container once:

```bash
docker compose exec ollama ollama pull llama3:8b-instruct
```

Then open [http://localhost:3000](http://localhost:3000).

Whisper Large V3 is large and CPU rendering can be slow. For personal use, native macOS with a local Python virtualenv is usually the simplest setup.
