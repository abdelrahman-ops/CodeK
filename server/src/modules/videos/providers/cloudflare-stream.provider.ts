import {
  IVideoProvider,
  DirectUploadParams,
  DirectUploadResult,
  PlaybackOptions,
  PlaybackInfo,
  VideoMetadata
} from '../video-provider.interface.js';

export interface CloudflareStreamConfig {
  accountId?: string;
  apiToken?: string;
  keyId?: string;
  keyPem?: string;
}

export class CloudflareStreamProvider implements IVideoProvider {
  readonly name = 'CLOUDFLARE_STREAM';
  private accountId: string;
  private apiToken: string;
  private keyId?: string;

  constructor(config?: CloudflareStreamConfig) {
    this.accountId = config?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.apiToken = config?.apiToken || process.env.CLOUDFLARE_STREAM_API_TOKEN || '';
    this.keyId = config?.keyId || process.env.CLOUDFLARE_STREAM_KEY_ID;
  }

  isConfigured(): boolean {
    return Boolean(this.accountId && this.apiToken);
  }

  async createDirectUpload(params: DirectUploadParams): Promise<DirectUploadResult> {
    if (!this.isConfigured()) {
      throw new Error('Cloudflare Stream credentials are not configured in environment.');
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/direct_upload`;
    const body: Record<string, any> = {
      maxDurationSeconds: params.maxDurationSeconds || 3600,
      requireSignedURLs: params.requireSignedPlayback ?? true
    };

    if (params.expiryMinutes) {
      const expiry = new Date(Date.now() + params.expiryMinutes * 60 * 1000).toISOString();
      body.expiry = expiry;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Cloudflare Stream direct upload request failed: ${res.status} - ${errorText}`);
    }

    const data: any = await res.json();
    if (!data.success || !data.result) {
      throw new Error(`Cloudflare Stream returned unsuccessful payload: ${JSON.stringify(data)}`);
    }

    return {
      uploadUrl: data.result.uploadURL,
      providerVideoId: data.result.uid,
      isDirectPost: true
    };
  }

  async getPlaybackInfo(providerVideoId: string, options?: PlaybackOptions): Promise<PlaybackInfo> {
    const isPrivate = options?.requireSignedPlayback ?? true;
    let token: string | undefined;

    // Generate signed token via Cloudflare API if private playback requested
    if (isPrivate && this.isConfigured()) {
      try {
        const tokenRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/${providerVideoId}/token`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              exp: Math.floor(Date.now() / 1000) + (options?.expiresInSeconds || 3600)
            })
          }
        );

        if (tokenRes.ok) {
          const tokenData: any = await tokenRes.json();
          if (tokenData.success && tokenData.result?.token) {
            token = tokenData.result.token;
          }
        }
      } catch (err) {
        // Fallback gracefully to video ID if token generation encounters an issue
      }
    }

    const streamIdentifier = token || providerVideoId;
    const playbackUrl = `https://iframe.videodelivery.net/${streamIdentifier}`;
    const hlsUrl = `https://videodelivery.net/${streamIdentifier}/manifest/video.m3u8`;
    const thumbnailUrl = `https://videodelivery.net/${providerVideoId}/thumbnails/thumbnail.jpg?time=5s`;

    return {
      provider: this.name,
      providerVideoId,
      playbackUrl,
      hlsUrl,
      thumbnailUrl,
      isPrivate,
      expiresAt: options?.expiresInSeconds
        ? new Date(Date.now() + options.expiresInSeconds * 1000)
        : undefined
    };
  }

  async getVideoMetadata(providerVideoId: string): Promise<VideoMetadata> {
    if (!this.isConfigured()) {
      return {
        providerVideoId,
        status: 'READY',
        thumbnailUrl: `https://videodelivery.net/${providerVideoId}/thumbnails/thumbnail.jpg?time=5s`
      };
    }

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/${providerVideoId}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiToken}`
        }
      }
    );

    if (!res.ok) {
      return {
        providerVideoId,
        status: 'ERROR'
      };
    }

    const data: any = await res.json();
    const result = data.result || {};
    const state = result.status?.state;

    let status: 'PENDING_UPLOAD' | 'PROCESSING' | 'READY' | 'ERROR' = 'PROCESSING';
    if (state === 'ready') status = 'READY';
    else if (state === 'error') status = 'ERROR';
    else if (state === 'queued' || state === 'inprogress') status = 'PROCESSING';

    return {
      providerVideoId,
      durationSeconds: result.duration ? Math.round(result.duration) : undefined,
      thumbnailUrl: result.thumbnail || `https://videodelivery.net/${providerVideoId}/thumbnails/thumbnail.jpg?time=5s`,
      status,
      width: result.input?.width,
      height: result.input?.height,
      raw: result
    };
  }

  async deleteVideo(providerVideoId: string): Promise<boolean> {
    if (!this.isConfigured()) return true;

    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/${providerVideoId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.apiToken}`
          }
        }
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}
