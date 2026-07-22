"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDemoWavUrl } from "@/lib/voice-journal-audio";
import { formatDuration } from "@/lib/voice-journal";
import { cn } from "@/lib/utils";

interface VoiceAudioPlayerProps {
  entryId: string;
  durationSeconds: number;
  audioUrl?: string;
  className?: string;
}

export function VoiceAudioPlayer({
  entryId,
  durationSeconds,
  audioUrl,
  className,
}: VoiceAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const generatedUrl = useRef<string | null>(null);
  const [readyUrl, setReadyUrl] = useState<string | null>(audioUrl ?? null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(durationSeconds);

    if (audioUrl) {
      setReadyUrl(audioUrl);
      return;
    }

    if (generatedUrl.current) {
      URL.revokeObjectURL(generatedUrl.current);
      generatedUrl.current = null;
    }
    const seed = entryId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const url = createDemoWavUrl(Math.min(durationSeconds, 18), seed);
    generatedUrl.current = url;
    setReadyUrl(url);

    return () => {
      if (generatedUrl.current) {
        URL.revokeObjectURL(generatedUrl.current);
        generatedUrl.current = null;
      }
    };
  }, [entryId, audioUrl, durationSeconds]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnded);
    };
  }, [readyUrl]);

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, (current / duration) * 100);
  }, [current, duration]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el || !readyUrl) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const seek = (value: number) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const next = (value / 100) * duration;
    el.currentTime = next;
    setCurrent(next);
  };

  return (
    <div className={cn("rounded-2xl border bg-secondary/40 p-4", className)}>
      {readyUrl ? <audio ref={audioRef} src={readyUrl} preload="metadata" /> : null}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          variant={playing ? "default" : "outline"}
          className="h-11 w-11 shrink-0 rounded-full"
          onClick={toggle}
          aria-label={playing ? "Pause journal audio" : "Play journal audio"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
        </Button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Volume2 className="h-3.5 w-3.5" />
              Voice recording
            </span>
            <span className="font-mono">
              {formatDuration(current)} / {formatDuration(duration || durationSeconds)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progress}
            onChange={(e) => seek(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
            aria-label="Seek audio"
          />
          <WaveformBars progress={progress} seed={entryId} playing={playing} />
        </div>
      </div>
    </div>
  );
}

function WaveformBars({
  progress,
  seed,
  playing,
}: {
  progress: number;
  seed: string;
  playing: boolean;
}) {
  const bars = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return Array.from({ length: 36 }, (_, i) => {
      const n = ((h >> (i % 16)) + i * 17) % 100;
      return 28 + (n % 72);
    });
  }, [seed]);

  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {bars.map((h, i) => {
        const active = (i / bars.length) * 100 <= progress;
        return (
          <span
            key={i}
            className={cn(
              "w-full rounded-full transition-colors",
              active ? "bg-primary" : "bg-primary/20",
              playing && active && "opacity-100",
            )}
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}
