import React from 'react';
import { Video, Clock, Target, ListChecks, CheckCircle2 } from 'lucide-react';
import { VideoBlueprint } from '../../types/api.js';
import { VideoPlayer } from '../shared/video-player.js';

interface VideoBlueprintCardProps {
  videoBlueprint?: VideoBlueprint | null;
  videoUrl?: string | null;
  playbackId?: string | null;
  playbackToken?: string | null;
  videoDurationSeconds?: number | null;
  lastWatchedPosition?: number;
  onTimeUpdate?: (seconds: number) => void;
  onVideoEnded?: () => void;
}

export const VideoBlueprintCard: React.FC<VideoBlueprintCardProps> = ({
  videoBlueprint,
  videoUrl,
  playbackId,
  playbackToken,
  videoDurationSeconds,
  lastWatchedPosition = 0,
  onTimeUpdate,
  onVideoEnded
}) => {
  const activeUrl = videoBlueprint?.playbackUrl || videoUrl;
  const isMock = videoBlueprint?.provider === 'MOCK' || (!activeUrl && !playbackId);
  const metadata = videoBlueprint?.metadata || {};
  const durationMin = videoBlueprint?.durationSeconds
    ? Math.round(videoBlueprint.durationSeconds / 60)
    : videoDurationSeconds
    ? Math.round(videoDurationSeconds / 60)
    : 12;

  // If real video playable stream/url or Mux playbackId exists
  if ((activeUrl || playbackId) && !isMock) {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-border bg-card shadow-sm mb-6">
        <VideoPlayer
          url={activeUrl || undefined}
          playbackId={playbackId || undefined}
          playbackToken={playbackToken || undefined}
          initialPosition={lastWatchedPosition}
          onProgress={(pos) => onTimeUpdate?.(pos)}
          onEnded={onVideoEnded}
        />
        <div className="p-3 bg-muted/40 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium">
            <Video className="w-4 h-4 text-primary" />
            {videoBlueprint?.title || 'الشرح المرئي للدرس'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {durationMin} دقيقة
          </span>
        </div>
      </div>
    );
  }

  // If Mock / Blueprint mode (Authoritative Phase 10 Blueprint)
  const rawOutline = metadata.outline || metadata.scriptOutline || '';
  const outlineItems = typeof rawOutline === 'string'
    ? rawOutline.split('\n').map((s: string) => s.replace(/^-\s*/, '').trim()).filter(Boolean)
    : Array.isArray(rawOutline) ? rawOutline : [];
  const objectiveText = metadata.objective || metadata.targetObjective;

  return (
    <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-background p-4 md:p-6 mb-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm md:text-base">
                {videoBlueprint?.title || 'مواصفة ومخطط الشرح المرئي'}
              </h3>
              {videoBlueprint?.code && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-muted text-muted-foreground border border-border">
                  {videoBlueprint.code}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              مخطط تفصيلي لإنتاج واستيعاب محتوى الدرس التطبيقي
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            <Clock className="w-3.5 h-3.5" />
            المدة المقترحة: {durationMin} دقيقة
          </span>
        </div>
      </div>

      {/* Blueprint Content Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Objective */}
        {objectiveText && (
          <div className="p-3.5 rounded-xl bg-background/80 border border-border/80 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Target className="w-4 h-4" />
              <span>هدف الشرح المرئي</span>
            </div>
            <p className="text-xs md:text-sm text-foreground/90 leading-relaxed">
              {objectiveText}
            </p>
          </div>
        )}

        {/* Outline Topics */}
        {outlineItems.length > 0 ? (
          <div className="p-3.5 rounded-xl bg-background/80 border border-border/80 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ListChecks className="w-4 h-4" />
              <span>محاور مخطط الفيديو</span>
            </div>
            <ul className="space-y-1.5 text-xs text-foreground/90">
              {outlineItems.map((item: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-background/80 border border-border/80 flex items-center justify-center text-xs text-muted-foreground">
            سيتم إرفاق تسجيل الشرح المرئي قريباً
          </div>
        )}
      </div>
    </div>
  );
};
