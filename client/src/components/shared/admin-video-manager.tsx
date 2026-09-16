import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api/client.js';
import { VideoAsset } from '../../types/api.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Dialog } from '../ui/dialog.js';
import { useToast } from '../ui/toast.js';
import {
  Video,
  UploadCloud,
  Link,
  Play,
  Trash2,
  RefreshCw,
  Clock,
  AlertTriangle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import axios from 'axios';
import { formatDuration } from '../../lib/i18n-helpers.js';
import { VideoPlayer } from './video-player.js';

interface AdminVideoManagerProps {
  lessonId?: string;
  attachedVideo?: VideoAsset | null;
  legacyVideoUrl?: string | null;
  legacyVideoDuration?: number | null;
  onVideoChanged: (asset: VideoAsset | null, legacyUrl?: string, legacyDuration?: number) => void;
}

export function AdminVideoManager({
  lessonId,
  attachedVideo,
  legacyVideoUrl,
  legacyVideoDuration,
  onVideoChanged
}: AdminVideoManagerProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'upload' | 'external'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // External link state
  const [externalUrl, setExternalUrl] = useState<string>('');
  const [externalDuration, setExternalDuration] = useState<number | ''>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Preview and Replace modals
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isReplaceMode, setIsReplaceMode] = useState<boolean>(false);
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState<boolean>(false);

  const hasAttachedVideo = Boolean(attachedVideo || legacyVideoUrl);
  const videoStatus = attachedVideo?.status || (legacyVideoUrl ? 'READY' : 'NOT_UPLOADED');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  /**
   * Direct Video Upload to Mux:
   * Requests authenticated upload URL from Fastify backend,
   * then streams file directly from browser to Mux via HTTP PUT.
   */
  const handleDirectUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setUploadProgress(5);

      // 1. Request authenticated Mux direct upload URL from backend
      const sessionRes = await api.videos.createDirectUpload({
        title: selectedFile.name,
        maxDurationSeconds: 7200,
        lessonId,
        isPrivate: true
      });

      const { uploadUrl, videoAssetId, isDirectPost } = sessionRes.data.data;
      setUploadProgress(15);

      // 2. Stream directly from browser to Mux (Never buffers through Fastify)
      if (isDirectPost) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        await axios.post(uploadUrl, formData, {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 80) / progressEvent.total) + 15;
              setUploadProgress(Math.min(percent, 95));
            }
          }
        });
      } else {
        await axios.put(uploadUrl, selectedFile, {
          headers: { 'Content-Type': selectedFile.type || 'video/mp4' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 80) / progressEvent.total) + 15;
              setUploadProgress(Math.min(percent, 95));
            }
          }
        });
      }

      setUploadProgress(98);

      // 3. Confirm completion with backend to check status
      const completeRes = await api.videos.confirmUpload({
        videoAssetId,
        lessonId
      });

      setUploadProgress(100);
      toast.success(t('videos.uploadSuccess'));
      setSelectedFile(null);
      setIsReplaceMode(false);
      onVideoChanged(completeRes.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.message || t('common.error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleConnectExternal = async () => {
    if (!externalUrl.trim()) return;

    try {
      setIsConnecting(true);
      const res = await api.videos.connectExternal({
        url: externalUrl.trim(),
        durationSeconds: externalDuration ? Number(externalDuration) : undefined,
        lessonId
      });

      toast.success(t('videos.connectSuccess'));
      setExternalUrl('');
      setExternalDuration('');
      setIsReplaceMode(false);
      onVideoChanged(res.data.data, externalUrl.trim(), externalDuration ? Number(externalDuration) : undefined);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRemoveVideo = async () => {
    try {
      if (lessonId) {
        await api.lessons.removeVideo(lessonId);
      }
      onVideoChanged(null, '', undefined);
      setIsReplaceMode(false);
      setIsConfirmRemoveOpen(false);
      toast.success(t('videos.removed'));
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  };

  const currentThumbnail = attachedVideo?.thumbnailUrl || (legacyVideoUrl?.includes('youtube.com') ? 'https://img.youtube.com/vi/default.jpg' : null);
  const currentDuration = attachedVideo?.durationSeconds || legacyVideoDuration || 0;
  const currentPlaybackUrl = attachedVideo?.playbackUrl || legacyVideoUrl;

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-4 space-y-4">
      {/* HEADER WITH STATUS BADGE */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {t('videos.managerTitle')}
            </h3>
            <p className="text-[11px] text-slate-500">
              {t('videos.managerSubtitle')}
            </p>
          </div>
        </div>

        {/* STATUS PILL */}
        <div>
          {videoStatus === 'READY' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {t('videos.ready')}
            </span>
          )}
          {(videoStatus === 'PROCESSING' || videoStatus === 'PENDING_UPLOAD') && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 flex items-center gap-1 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t('videos.processing')}
            </span>
          )}
          {videoStatus === 'ERROR' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {t('videos.failed')}
            </span>
          )}
          {videoStatus === 'NOT_UPLOADED' && !hasAttachedVideo && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {t('videos.notUploaded')}
            </span>
          )}
        </div>
      </div>

      {/* ERROR NOTICE IF VIDEO FAILED PROCESSING */}
      {videoStatus === 'ERROR' && attachedVideo?.errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">{t('videos.failed')}</p>
            <p className="text-[11px] opacity-90">{attachedVideo.errorMessage}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsReplaceMode(true)}
            className="ms-auto text-xs shrink-0"
          >
            {t('videos.retryUpload')}
          </Button>
        </div>
      )}

      {/* ATTACHED VIDEO VIEW */}
      {hasAttachedVideo && !isReplaceMode ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="relative w-24 h-14 rounded-lg bg-slate-900 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
              {currentThumbnail ? (
                <img src={currentThumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
              ) : (
                <Video className="w-6 h-6 text-slate-500" />
              )}
              {currentPlaybackUrl && videoStatus === 'READY' && (
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="absolute inset-0 bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
                  title="Preview"
                >
                  <Play className="w-4 h-4 fill-white" />
                </button>
              )}
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                {attachedVideo?.title || 'Attached Lesson Video'}
              </h4>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {currentDuration ? formatDuration(Math.ceil(currentDuration / 60)) : t('videos.processing')}
                </span>
                <span>•</span>
                <span className="uppercase text-[10px] font-semibold text-slate-400">
                  {attachedVideo?.provider || 'EXTERNAL'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {currentPlaybackUrl && videoStatus === 'READY' && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsPreviewOpen(true)}
                className="text-xs gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{t('common.preview', 'Preview')}</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsReplaceMode(true)}
              className="text-xs gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('videos.replace')}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsConfirmRemoveOpen(true)}
              className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              title={t('videos.removeVideo')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        /* UPLOAD / CONNECT TABS */
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{t('videos.directUpload')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('external')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'external'
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              <span>{t('videos.connectExternal')}</span>
            </button>

            {isReplaceMode && (
              <button
                type="button"
                onClick={() => setIsReplaceMode(false)}
                className="text-xs text-slate-400 hover:text-slate-700 ml-auto"
              >
                {t('common.cancel', 'Cancel')}
              </button>
            )}
          </div>

          {activeTab === 'upload' ? (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 text-center hover:border-brand-500 transition-colors bg-slate-50/50 dark:bg-slate-900/30">
                <input
                  type="file"
                  id="video-upload-input"
                  accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
                <label htmlFor="video-upload-input" className="cursor-pointer space-y-1 block">
                  <UploadCloud className="w-8 h-8 text-brand-500 mx-auto mb-1" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {selectedFile ? selectedFile.name : t('videos.selectFilePrompt')}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    MP4, WebM, MOV (Mux Encoded with HLS & Signed Playback)
                  </p>
                </label>
              </div>

              {isUploading && (
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-600 h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                      {t('videos.uploadingProgress')}
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              )}

              {selectedFile && !isUploading && (
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedFile(null)}
                    className="text-xs"
                  >
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleDirectUpload}
                    className="text-xs gap-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{t('videos.startUpload')}</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Input
                    label={t('videos.videoUrl')}
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                  />
                </div>
                <Input
                  label={t('videos.durationSeconds')}
                  type="number"
                  placeholder="900"
                  value={externalDuration}
                  onChange={(e) => setExternalDuration(e.target.value ? Number(e.target.value) : '')}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConnectExternal}
                  isLoading={isConnecting}
                  disabled={!externalUrl.trim()}
                  className="text-xs gap-1.5"
                >
                  <Link className="w-3.5 h-3.5" />
                  <span>{t('videos.connectButton')}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIDEO PREVIEW DIALOG */}
      <Dialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={attachedVideo?.title || 'Video Preview'}
        className="max-w-3xl"
      >
        <div className="space-y-3 pt-2">
          <div className="aspect-video w-full rounded-2xl bg-black overflow-hidden flex items-center justify-center">
            {currentPlaybackUrl || attachedVideo?.playbackId ? (
              <VideoPlayer
                url={currentPlaybackUrl || undefined}
                playbackId={attachedVideo?.playbackId || undefined}
              />
            ) : (
              <p className="text-xs text-slate-400">No playback URL available</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setIsPreviewOpen(false)}>
              {t('common.close', 'Close')}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* CONFIRM REMOVE DIALOG */}
      <Dialog
        isOpen={isConfirmRemoveOpen}
        onClose={() => setIsConfirmRemoveOpen(false)}
        title={t('videos.confirmRemoveTitle')}
        className="max-w-md"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {t('videos.confirmRemoveDesc')}
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsConfirmRemoveOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button size="sm" variant="danger" onClick={handleRemoveVideo}>
              {t('videos.removeVideo')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
