"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Film, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { JobRecord } from "@/lib/types";

const steps: Array<{ id: JobRecord["step"]; label: string }> = [
  { id: "downloading", label: "Downloading video" },
  { id: "transcribing", label: "Transcribing audio" },
  { id: "detecting", label: "Detecting clips" },
  { id: "subtitles", label: "Generating subtitles" },
  { id: "rendering", label: "Rendering videos" }
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [job, setJob] = useState<JobRecord | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start job");
      setJob(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!job || job.status === "complete" || job.status === "failed") return;

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
      if (response.ok) {
        setJob(await response.json());
      }
    }, 1800);

    return () => window.clearInterval(interval);
  }, [job]);

  const currentStepIndex = useMemo(() => steps.findIndex((step) => step.id === job?.step), [job?.step]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-8 md:px-8">
      <header className="flex flex-col gap-3 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
            <Sparkles className="h-4 w-4" />
            Local AI short-form editor
          </div>
          <h1 className="text-3xl font-bold tracking-normal md:text-5xl">Personal AI YouTube Shorts Generator</h1>
        </div>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          Paste a YouTube URL and generate a small set of polished vertical clips with burned captions.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Generate Clips</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div className="grid gap-2">
                <Label htmlFor="youtube-url">YouTube URL</Label>
                <Input
                  id="youtube-url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  disabled={isSubmitting || job?.status === "running"}
                />
              </div>
              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
              <Button type="submit" disabled={!url || isSubmitting || job?.status === "running"} className="w-full">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
                Generate Clips
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">{job?.message || "Waiting for a video"}</p>
              <span className="text-sm tabular-nums text-muted-foreground">{job ? `${job.progress}%` : "0%"}</span>
            </div>
            <Progress value={job?.progress || 0} />
            <div className="grid gap-3 sm:grid-cols-2">
              {steps.map((step, index) => {
                const complete = currentStepIndex > index || job?.status === "complete";
                const active = job?.step === step.id;
                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                      active ? "border-primary bg-primary/10 text-primary" : complete ? "bg-muted" : "bg-white"
                    }`}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                      {index + 1}
                    </span>
                    {step.label}
                  </div>
                );
              })}
            </div>
            {job?.status === "failed" ? (
              <pre className="max-h-56 overflow-auto rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                {job.error}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {job?.clips.length ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-2xl font-bold">Generated Clips</h2>
            <span className="text-sm text-muted-foreground">{job.clips.length} ready</span>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {job.clips.map((clip) => (
              <Card key={clip.id} className="overflow-hidden">
                <video className="aspect-[9/16] w-full" src={clip.previewUrl} controls preload="metadata" />
                <CardHeader>
                  <CardTitle className="leading-snug">{clip.metadata.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary">
                      Score {clip.metadata.score.toFixed(1)}
                    </span>
                    <span className="rounded-md bg-muted px-2 py-1">{clip.duration.toFixed(1)}s</span>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{clip.metadata.caption}</p>
                  <Button asChild variant="secondary" className="w-full">
                    <a href={clip.downloadUrl}>
                      <Download className="h-4 w-4" />
                      Download MP4
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
