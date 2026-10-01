import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, RotateCcw, AlertCircle, Video, ExternalLink } from 'lucide-react';
import MuxPlayer from '@mux/mux-player-react';

interface VideoPlayerProps {
  url?: string;
  playbackId?: string;
  playbackToken?: string;
  initialPosition?: number; // In seconds
  onProgress?: (position: number, percentage?: number) => void;
  onEnded?: () => void;
  className?: string;
}

export function formatTimestamp(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function parseYouTubeVideoId(url: string): string | null {
  try {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  } catch {
    return null;
  }
}

export function parseVimeoVideoId(url: string): string | null {
  try {
    const regExp = /(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:[a-zA-Z0-9_\-]+)?/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function VideoPlayer({
  url = '',
  playbackId,
  playbackToken,
  initialPosition = 0,
  onProgress,
  onEnded,
  className = ''
}: VideoPlayerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastReportedTime = useRef<number>(initialPosition);
  const [hasResumed, setHasResumed] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(initialPosition);
  const [duration, setDuration] = useState<number>(0);

  // Debounced progress callback
  const reportProgress = useCallback(
    (pos: number, dur?: number) => {
      if (Math.abs(pos - lastReportedTime.current) >= 3 || (dur && pos >= dur - 1)) {
        lastReportedTime.current = pos;
        const pct = dur && dur > 0 ? Math.min(100, Math.round((pos / dur) * 100)) : undefined;
        onProgress?.(pos, pct);
      }
    },
    [onProgress]
  );

  // Extract Mux playbackId and token from URL if not passed explicitly
  let effectivePlaybackId = playbackId;
  let effectiveToken = playbackToken;

  if (!effectivePlaybackId && url) {
    const muxMatch = url.match(/stream\.mux\.com\/([a-zA-Z0-9_-]+)\.m3u8(?:\?token=([a-zA-Z0-9_.-]+))?/);
    if (muxMatch) {
      effectivePlaybackId = muxMatch[1];
      effectiveToken = muxMatch[2] || effectiveToken;
    }
  }

  // 1. Mux Signed Video Player
  if (effectivePlaybackId) {
    return (
      <div className={`relative w-full rounded-2xl overflow-hidden shadow-lg bg-black aspect-video ${className}`}>
        <MuxPlayer
          playbackId={effectivePlaybackId}
          tokens={effectiveToken ? { playback: effectiveToken } : undefined}
          startTime={initialPosition}
          streamType="on-demand"
          onTimeUpdate={(e: any) => {
            const cur = e.target?.currentTime || 0;
            const dur = e.target?.duration || 0;
            setCurrentTime(cur);
            reportProgress(cur, dur);
          }}
          onEnded={onEnded}
          style={{ width: '100%', height: '100%' }}
        />
        {initialPosition > 5 && (
          <div className="absolute top-3 start-3 px-3 py-1 rounded-lg bg-slate-900/80 backdrop-blur-sm text-[11px] font-semibold text-emerald-400 border border-emerald-500/20 shadow-sm pointer-events-none z-10">
            {t('lessons.resumedFrom')} {formatTimestamp(initialPosition)}
          </div>
        )}
      </div>
    );
  }

  const ytId = parseYouTubeVideoId(url);
  const vimeoId = parseVimeoVideoId(url);
  const isDirectVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);

  // HTML5 native video initialization
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isDirectVideo) return;

    const handleLoadedMetadata = () => {
      setDuration(vid.duration);
      if (initialPosition > 0 && initialPosition < vid.duration) {
        vid.currentTime = initialPosition;
        setHasResumed(true);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(vid.currentTime);
      reportProgress(vid.currentTime, vid.duration);
    };

    const handleEnded = () => {
      onEnded?.();
    };

    vid.addEventListener('loadedmetadata', handleLoadedMetadata);
    vid.addEventListener('timeupdate', handleTimeUpdate);
    vid.addEventListener('ended', handleEnded);

    return () => {
      vid.removeEventListener('loadedmetadata', handleLoadedMetadata);
      vid.removeEventListener('timeupdate', handleTimeUpdate);
      vid.removeEventListener('ended', handleEnded);
    };
  }, [isDirectVideo, initialPosition, reportProgress, onEnded]);

  // YouTube embed with start time parameter
  if (ytId) {
    const startParam = initialPosition > 5 ? `&start=${Math.floor(initialPosition)}` : '';
    const embedUrl = `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&enablejsapi=1${startParam}`;

    return (
      <div className={`relative w-full rounded-2xl overflow-hidden shadow-lg bg-black aspect-video ${className}`}>
        <iframe
          src={embedUrl}
          title="Video lesson player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full border-0"
        />
        {initialPosition > 5 && (
          <div className="absolute top-3 start-3 px-3 py-1 rounded-lg bg-slate-900/80 backdrop-blur-sm text-[11px] font-semibold text-amber-400 border border-amber-500/20 shadow-sm pointer-events-none">
            {t('lessons.resumedFrom')} {formatTimestamp(initialPosition)}
          </div>
        )}
      </div>
    );
  }

  // Vimeo embed with start time
  if (vimeoId) {
    const timeHash = initialPosition > 5 ? `#t=${Math.floor(initialPosition)}s` : '';
    const embedUrl = `https://player.vimeo.com/video/${vimeoId}?dnt=1${timeHash}`;

    return (
      <div className={`relative w-full rounded-2xl overflow-hidden shadow-lg bg-black aspect-video ${className}`}>
        <iframe
          src={embedUrl}
          title="Video lesson player"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0"
        />
        {initialPosition > 5 && (
          <div className="absolute top-3 start-3 px-3 py-1 rounded-lg bg-slate-900/80 backdrop-blur-sm text-[11px] font-semibold text-amber-400 border border-amber-500/20 shadow-sm pointer-events-none">
            {t('lessons.resumedFrom')} {formatTimestamp(initialPosition)}
          </div>
        )}
      </div>
    );
  }

  // Direct HTML5 Video
  if (isDirectVideo) {
    return (
      <div className={`relative w-full rounded-2xl overflow-hidden shadow-lg bg-black aspect-video ${className}`}>
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          className="w-full h-full object-contain"
        />
        {hasResumed && (
          <div className="absolute top-3 start-3 px-3 py-1 rounded-lg bg-slate-900/80 backdrop-blur-sm text-[11px] font-semibold text-emerald-400 border border-emerald-500/20 shadow-sm pointer-events-none">
            {t('lessons.resumedFrom')} {formatTimestamp(initialPosition)}
          </div>
        )}
      </div>
    );
  }

  // Fallback for external generic links
  if (url) {
    return (
      <div className={`w-full rounded-2xl p-6 bg-slate-900 text-white flex flex-col items-center justify-center text-center gap-3 aspect-video ${className}`}>
        <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
          <Video className="w-6 h-6" />
        </div>
        <div>
          <h4 className="font-bold text-sm text-slate-100">{t('lessons.externalVideoTitle')}</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {t('lessons.externalVideoDesc')}
          </p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white transition shadow-md"
        >
          <span>{t('lessons.openVideo')}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  return null;
}
