export interface DirectUploadParams {
  maxDurationSeconds?: number;
  requireSignedPlayback?: boolean;
  meta?: Record<string, any>;
  expiryMinutes?: number;
}

export interface DirectUploadResult {
  uploadUrl: string;
  providerVideoId: string;
  expiresAt?: Date;
  isDirectPost: boolean;
  headers?: Record<string, string>;
}

export interface PlaybackOptions {
  requireSignedPlayback?: boolean;
  expiresInSeconds?: number;
  playbackId?: string;
  durationSeconds?: number;
  userContext?: {
    userId: string;
    studentId?: string;
  };
}

export interface PlaybackInfo {
  provider: string;
  providerVideoId: string;
  playbackUrl: string; // iframe embed or streaming manifest
  playbackId?: string;
  token?: string;
  thumbnailUrl?: string;
  hlsUrl?: string;
  dashUrl?: string;
  durationSeconds?: number;
  isPrivate: boolean;
  expiresAt?: Date;
}

export interface VideoMetadata {
  providerVideoId: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  status: 'PENDING_UPLOAD' | 'PROCESSING' | 'READY' | 'ERROR';
  width?: number;
  height?: number;
  raw?: Record<string, any>;
}

export interface IVideoProvider {
  readonly name: string;
  isConfigured(): boolean;
  createDirectUpload(params: DirectUploadParams): Promise<DirectUploadResult>;
  getPlaybackInfo(providerVideoId: string, options?: PlaybackOptions): Promise<PlaybackInfo>;
  getVideoMetadata(providerVideoId: string): Promise<VideoMetadata>;
  deleteVideo(providerVideoId: string): Promise<boolean>;
}
