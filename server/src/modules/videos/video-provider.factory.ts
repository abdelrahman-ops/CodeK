import { IVideoProvider } from './video-provider.interface.js';
import { CloudflareStreamProvider } from './providers/cloudflare-stream.provider.js';
import { MockLocalVideoProvider } from './providers/mock-video.provider.js';
import { ExternalVideoProvider } from './providers/external-video.provider.js';
import { MuxVideoProvider } from './providers/mux-video.provider.js';

export class VideoProviderFactory {
  private static instance: VideoProviderFactory;
  private providers = new Map<string, IVideoProvider>();

  private constructor() {
    this.registerProvider(new MockLocalVideoProvider());
    this.registerProvider(new ExternalVideoProvider());
    this.registerProvider(new CloudflareStreamProvider());
    this.registerProvider(new MuxVideoProvider());
  }

  public static getInstance(): VideoProviderFactory {
    if (!VideoProviderFactory.instance) {
      VideoProviderFactory.instance = new VideoProviderFactory();
    }
    return VideoProviderFactory.instance;
  }

  public registerProvider(provider: IVideoProvider): void {
    this.providers.set(provider.name.toUpperCase(), provider);
  }

  public getProvider(name?: string): IVideoProvider {
    if (name) {
      const match = this.providers.get(name.toUpperCase());
      if (match) return match;
    }

    const envProvider = (process.env.VIDEO_PROVIDER || '').toUpperCase();
    if (envProvider.includes('MUX')) {
      const mux = this.providers.get('MUX');
      if (mux && mux.isConfigured()) return mux;
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Mux credentials are misconfigured or missing in production.');
      }
    } else if (envProvider.includes('CLOUDFLARE')) {
      const cf = this.providers.get('CLOUDFLARE_STREAM');
      if (cf && cf.isConfigured()) return cf;
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Cloudflare Stream credentials are misconfigured or missing in production.');
      }
    } else if (envProvider.includes('EXTERNAL')) {
      const ext = this.providers.get('EXTERNAL');
      if (ext) return ext;
    }

    // In production, fallback to Mock Provider is strictly prohibited
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'VIDEO_PROVIDER is not configured for production. An explicit provider (MUX, CLOUDFLARE_STREAM or EXTERNAL) is required. Mock video provider is strictly forbidden in production.'
      );
    }

    // Default fallback to Mock Provider for testing/local development
    return this.providers.get('MOCK')!;
  }
}

export const videoProviderFactory = VideoProviderFactory.getInstance();
