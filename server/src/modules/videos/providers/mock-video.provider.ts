import {
  IVideoProvider,
  DirectUploadParams,
  DirectUploadResult,
  PlaybackOptions,
  PlaybackInfo,
  VideoMetadata
} from '../video-provider.interface.js';
import crypto from 'crypto';

export class MockLocalVideoProvider implements IVideoProvider {
  readonly name = 'MOCK';

  private storage = new Map<string, { durationSeconds: number; status: 'READY' | 'PENDING_UPLOAD' }>();

  isConfigured(): boolean {
    return true;
  }

  async createDirectUpload(params: DirectUploadParams): Promise<DirectUploadResult> {
    const providerVideoId = `mock_vid_${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + (params.expiryMinutes || 30) * 60 * 1000);
    
    this.storage.set(providerVideoId, {
      durationSeconds: params.maxDurationSeconds || 900,
      status: 'PENDING_UPLOAD'
    });

    return {
      uploadUrl: `http://localhost:5000/api/v1/videos/mock-upload/${providerVideoId}`,
      providerVideoId,
      expiresAt,
      isDirectPost: true,
      headers: { 'x-mock-upload': 'true' }
    };
  }

  async getPlaybackInfo(providerVideoId: string, options?: PlaybackOptions): Promise<PlaybackInfo> {
    const isPrivate = options?.requireSignedPlayback ?? true;
    const token = isPrivate ? `mock_jwt_${crypto.randomBytes(6).toString('hex')}` : undefined;
    
    // Sample educational embed or media manifest
    const playbackUrl = token
      ? `https://media.codek.local/embed/${providerVideoId}?token=${token}`
      : `https://media.codek.local/embed/${providerVideoId}`;

    return {
      provider: this.name,
      providerVideoId,
      playbackUrl,
      thumbnailUrl: `https://media.codek.local/thumbnails/${providerVideoId}.jpg`,
      hlsUrl: `https://media.codek.local/hls/${providerVideoId}/manifest.m3u8`,
      durationSeconds: this.storage.get(providerVideoId)?.durationSeconds || 720,
      isPrivate,
      expiresAt: options?.expiresInSeconds
        ? new Date(Date.now() + options.expiresInSeconds * 1000)
        : new Date(Date.now() + 3600 * 1000)
    };
  }

  async getVideoMetadata(providerVideoId: string): Promise<VideoMetadata> {
    const record = this.storage.get(providerVideoId);
    return {
      providerVideoId,
      durationSeconds: record?.durationSeconds || 720,
      thumbnailUrl: `https://media.codek.local/thumbnails/${providerVideoId}.jpg`,
      status: 'READY',
      width: 1920,
      height: 1080
    };
  }

  async deleteVideo(providerVideoId: string): Promise<boolean> {
    this.storage.delete(providerVideoId);
    return true;
  }
}
