import {
  IVideoProvider,
  DirectUploadParams,
  DirectUploadResult,
  PlaybackOptions,
  PlaybackInfo,
  VideoMetadata
} from '../video-provider.interface.js';

export class ExternalVideoProvider implements IVideoProvider {
  readonly name = 'EXTERNAL';

  isConfigured(): boolean {
    return true;
  }

  async createDirectUpload(_params: DirectUploadParams): Promise<DirectUploadResult> {
    throw new Error('Direct upload is not supported for external video links. Use connectExternalVideo instead.');
  }

  async getPlaybackInfo(providerVideoId: string, _options?: PlaybackOptions): Promise<PlaybackInfo> {
    let playbackUrl = providerVideoId;
    let thumbnailUrl: string | undefined;

    // YouTube handling
    const ytMatch = providerVideoId.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
      const ytId = ytMatch[1];
      playbackUrl = `https://www.youtube.com/embed/${ytId}`;
      thumbnailUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }

    // Vimeo handling
    const vimeoMatch = providerVideoId.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/i);
    if (vimeoMatch && vimeoMatch[3]) {
      const vimeoId = vimeoMatch[3];
      playbackUrl = `https://player.vimeo.com/video/${vimeoId}`;
      thumbnailUrl = `https://vumbnail.com/${vimeoId}.jpg`;
    }

    return {
      provider: this.name,
      providerVideoId,
      playbackUrl,
      thumbnailUrl,
      isPrivate: false
    };
  }

  async getVideoMetadata(providerVideoId: string): Promise<VideoMetadata> {
    const info = await this.getPlaybackInfo(providerVideoId);
    return {
      providerVideoId,
      thumbnailUrl: info.thumbnailUrl,
      status: 'READY'
    };
  }

  async deleteVideo(_providerVideoId: string): Promise<boolean> {
    return true;
  }
}
