import Mux from '@mux/mux-node';
import { env } from '../../../config/env.js';
import {
  IVideoProvider,
  DirectUploadParams,
  DirectUploadResult,
  PlaybackOptions,
  PlaybackInfo,
  VideoMetadata
} from '../video-provider.interface.js';

export interface MuxProviderConfig {
  tokenId?: string;
  tokenSecret?: string;
  signingKeyId?: string;
  signingPrivateKey?: string;
  webhookSecret?: string;
  client?: Mux;
}

/**
 * Normalizes Mux RSA private signing key:
 * - Strips carriage returns (\r) from Windows line endings
 * - Resolves escaped literal newlines (\n) from environment variable strings
 * - Handles base64 encoded PEM keys
 */
export function normalizeMuxPrivateKey(key: string): string {
  if (!key) return '';
  let trimmed = key.trim().replace(/\r/g, '');

  if (trimmed.includes('\\n')) {
    trimmed = trimmed.replace(/\\n/g, '\n');
  }

  if (trimmed.startsWith('-----BEGIN')) {
    return trimmed;
  }

  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8').trim().replace(/\r/g, '');
    if (decoded.startsWith('-----BEGIN')) {
      return decoded.includes('\\n') ? decoded.replace(/\\n/g, '\n') : decoded;
    }
  } catch {
    // Return trimmed fallback
  }

  return trimmed;
}

/**
 * Calculates a secure, short-lived playback token expiration:
 * - Base buffer: 3600 seconds (1 hour) for student pauses, note-taking, and review
 * - Adds video duration if known (e.g., 45-minute lesson = 2700s + 3600s = 6300s = 1.75 hours)
 * - Clamped to a minimum of 1 hour and a maximum of 4 hours to prevent long-lived link leakage
 */
export function calculatePlaybackExpiration(durationSeconds?: number, overrideSeconds?: number): number {
  if (overrideSeconds && overrideSeconds > 0) {
    return Math.min(Math.max(overrideSeconds, 3600), 14400);
  }
  const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : 0;
  const total = Math.round(duration + 3600);
  return Math.min(Math.max(total, 3600), 14400);
}

export class MuxVideoProvider implements IVideoProvider {
  readonly name = 'MUX';
  private client: Mux;
  private tokenId: string;
  private tokenSecret: string;
  private signingKeyId: string;
  private signingPrivateKey: string;
  private webhookSecret: string;

  constructor(config?: MuxProviderConfig) {
    this.tokenId = config?.tokenId || env.MUX_TOKEN_ID || process.env.MUX_TOKEN_ID || '';
    this.tokenSecret = config?.tokenSecret || env.MUX_TOKEN_SECRET || process.env.MUX_TOKEN_SECRET || '';
    this.signingKeyId = config?.signingKeyId || env.MUX_SIGNING_KEY_ID || process.env.MUX_SIGNING_KEY_ID || '';
    this.signingPrivateKey = config?.signingPrivateKey || env.MUX_SIGNING_PRIVATE_KEY || process.env.MUX_SIGNING_PRIVATE_KEY || '';
    this.webhookSecret = config?.webhookSecret || env.MUX_WEBHOOK_SECRET || process.env.MUX_WEBHOOK_SECRET || '';

    if (config?.client) {
      this.client = config.client;
    } else {
      this.client = new Mux({
        tokenId: this.tokenId || 'dummy_id',
        tokenSecret: this.tokenSecret || 'dummy_secret',
        webhookSecret: this.webhookSecret || undefined
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.tokenId && this.tokenSecret);
  }

  isSigningConfigured(): boolean {
    return Boolean(this.signingKeyId && this.signingPrivateKey);
  }

  getMuxClient(): Mux {
    return this.client;
  }

  getWebhookSecret(): string {
    return this.webhookSecret;
  }

  /**
   * Creates an authenticated Mux Direct Upload URL.
   * Direct uploads are strictly configured with playback_policy: ["signed"] for content protection.
   */
  async createDirectUpload(params: DirectUploadParams): Promise<DirectUploadResult> {
    if (!this.isConfigured()) {
      throw new Error('Mux credentials (MUX_TOKEN_ID, MUX_TOKEN_SECRET) are not configured.');
    }

    const upload = await this.client.video.uploads.create({
      new_asset_settings: {
        playback_policy: ['signed'],
        passthrough: params.meta ? JSON.stringify(params.meta) : undefined
      },
      cors_origin: '*'
    });

    return {
      uploadUrl: upload.url || '',
      providerVideoId: upload.id,
      isDirectPost: false,
      headers: {}
    };
  }

  /**
   * Generates signed playback authorization using Mux RS256 signing keys.
   * NEVER exposes signing keys, and produces short-lived playback tokens.
   */
  async getPlaybackInfo(providerVideoId: string, options?: PlaybackOptions): Promise<PlaybackInfo> {
    const playbackId = options?.playbackId || providerVideoId;

    if (!playbackId) {
      throw new Error('Mux playbackId is required to generate playback information.');
    }

    if (!this.isSigningConfigured()) {
      throw new Error('Mux signing keys (MUX_SIGNING_KEY_ID, MUX_SIGNING_PRIVATE_KEY) are not configured.');
    }

    const expirationSeconds = calculatePlaybackExpiration(options?.durationSeconds, options?.expiresInSeconds);
    const normalizedKey = normalizeMuxPrivateKey(this.signingPrivateKey);

    const token = await this.client.jwt.signPlaybackId(playbackId, {
      keyId: this.signingKeyId,
      keySecret: normalizedKey,
      expiration: `${expirationSeconds}s`,
      type: 'video'
    });

    const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

    return {
      provider: this.name,
      providerVideoId,
      playbackId,
      token,
      playbackUrl: hlsUrl,
      hlsUrl,
      thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
      isPrivate: true,
      durationSeconds: options?.durationSeconds,
      expiresAt
    };
  }

  /**
   * Retrieves asset or upload metadata from Mux.
   */
  async getVideoMetadata(providerVideoId: string): Promise<VideoMetadata> {
    if (!this.isConfigured()) {
      return {
        providerVideoId,
        status: 'READY'
      };
    }

    try {
      // First attempt to retrieve as an asset
      const asset = await this.client.video.assets.retrieve(providerVideoId);
      let status: 'PENDING_UPLOAD' | 'PROCESSING' | 'READY' | 'ERROR' = 'PROCESSING';
      if (asset.status === 'ready') status = 'READY';
      else if (asset.status === 'errored') status = 'ERROR';
      else if (asset.status === 'preparing') status = 'PROCESSING';

      const signedPlayback = asset.playback_ids?.find((p) => p.policy === 'signed');
      const playbackId = signedPlayback?.id || asset.playback_ids?.[0]?.id;

      return {
        providerVideoId: asset.id,
        durationSeconds: asset.duration ? Math.round(asset.duration) : undefined,
        thumbnailUrl: playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : undefined,
        status,
        raw: {
          assetId: asset.id,
          playbackId,
          aspectRatio: asset.aspect_ratio,
          errors: asset.errors
        }
      };
    } catch {
      // Fallback: check if it's an upload ID
      try {
        const upload = await this.client.video.uploads.retrieve(providerVideoId);
        if (upload.asset_id) {
          return this.getVideoMetadata(upload.asset_id);
        }
        return {
          providerVideoId,
          status: upload.status === 'errored' ? 'ERROR' : 'PENDING_UPLOAD',
          raw: upload
        };
      } catch (err: any) {
        return {
          providerVideoId,
          status: 'ERROR',
          raw: { error: err.message }
        };
      }
    }
  }

  /**
   * Safely deletes an asset from Mux.
   */
  async deleteVideo(providerVideoId: string): Promise<boolean> {
    if (!this.isConfigured()) return true;

    try {
      await this.client.video.assets.delete(providerVideoId);
      return true;
    } catch {
      return false;
    }
  }
}
