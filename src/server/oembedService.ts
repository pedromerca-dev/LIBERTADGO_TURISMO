/**
 * Safe oEmbed and Video Preview Service for LibertadGO / Wayra
 * Strictly adheres to SSRF protection, domain allowlists, timeout controls,
 * response size limits, and non-dangerous data sanitization.
 */

import { parseAndValidateVideoUrl, ParsedVideoUrl } from '../utils/videoUrlParser.ts';

export type PreviewState = 'idle' | 'loading' | 'ready' | 'unavailable' | 'provider_error' | 'invalid_format';

export interface VideoPreviewData {
  platform: 'tiktok' | 'youtube' | 'instagram';
  videoId: string;
  canonicalUrl: string;
  embedUrl: string;
  title?: string;
  authorName?: string;
  authorUrl?: string;
  thumbnailUrl?: string;
  providerName?: string;
  width?: number;
  height?: number;
}

export interface VideoPreviewResult {
  success: boolean;
  state: PreviewState;
  data?: VideoPreviewData;
  error?: string;
  message?: string;
}

interface CacheEntry {
  result: VideoPreviewResult;
  expiresAt: number;
}

// In-memory cache with 15-minute TTL (max 300 entries)
const previewCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_SIZE = 300;

function getCached(key: string): VideoPreviewResult | null {
  const entry = previewCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    previewCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: VideoPreviewResult): void {
  if (previewCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = previewCache.keys().next().value;
    if (oldestKey) previewCache.delete(oldestKey);
  }
  previewCache.set(key, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Validates domain against SSRF and strict official allowlist
 */
function isAllowedDomain(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^www\./, '');
  const allowed = [
    'youtube.com',
    'm.youtube.com',
    'youtu.be',
    'tiktok.com',
    'm.tiktok.com',
    'vt.tiktok.com',
    'vm.tiktok.com',
    'instagram.com',
  ];
  return allowed.includes(normalized);
}

/**
 * Checks for IP addresses or local/private addresses to prevent SSRF
 */
function isPrivateOrIpHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower === '0.0.0.0') {
    return true;
  }
  // IPv4 regex check
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(lower)) {
    return true; // Reject all raw IP addresses
  }
  // IPv6 check
  if (lower.includes(':')) {
    return true;
  }
  // Internal domain extensions
  if (lower.endsWith('.local') || lower.endsWith('.internal') || lower.endsWith('.corp')) {
    return true;
  }
  return false;
}

/**
 * Fetch helper with strict timeout and maximum byte size to prevent memory exhaustion
 */
async function fetchSafeJson(url: string, timeoutMs = 5000, maxBytes = 50000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Wayra-TouristPlanner/1.0 (+https://wayra.pe)',
        Accept: 'application/json',
      },
    });

    clearTimeout(timer);

    if (!res.ok) {
      const err: any = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const text = await res.text();
    if (text.length > maxBytes) {
      throw new Error('Payload size exceeded limit');
    }

    return JSON.parse(text);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Main function to fetch and format video preview data safely
 */
export async function getVideoPreview(rawUrl: string): Promise<VideoPreviewResult> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      success: false,
      state: 'invalid_format',
      error: 'La URL del video es requerida',
      message: 'Ingresa un enlace de video válido para visualizar la vista previa',
    };
  }

  const trimmed = rawUrl.trim();

  // 1. Validation with existing parser
  const parsed = parseAndValidateVideoUrl(trimmed);
  if (!parsed.isValid || !parsed.data) {
    return {
      success: false,
      state: 'invalid_format',
      error: parsed.error || 'Formato de enlace de video no válido',
      message: parsed.error || 'El enlace proporcionado no coincide con los formatos admitidos de TikTok, YouTube o Instagram.',
    };
  }

  const { platform, externalVideoId, canonicalUrl, authorHandle } = parsed.data;

  // 2. Security & SSRF checks
  let parsedUrlObj: URL;
  try {
    parsedUrlObj = new URL(canonicalUrl);
  } catch {
    return {
      success: false,
      state: 'invalid_format',
      error: 'URL no válida',
    };
  }

  if (parsedUrlObj.protocol !== 'https:') {
    return {
      success: false,
      state: 'invalid_format',
      error: 'Solo se permiten URLs seguras con HTTPS',
    };
  }

  if (isPrivateOrIpHost(parsedUrlObj.hostname) || !isAllowedDomain(parsedUrlObj.hostname)) {
    return {
      success: false,
      state: 'invalid_format',
      error: 'Dominio no permitido por razones de seguridad',
    };
  }

  // 3. Cache check
  const cacheKey = canonicalUrl;
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  let result: VideoPreviewResult;

  // 4. Platform-specific resolution
  try {
    if (platform === 'youtube') {
      result = await resolveYouTubePreview(externalVideoId, canonicalUrl, authorHandle);
    } else if (platform === 'tiktok') {
      result = await resolveTikTokPreview(externalVideoId, canonicalUrl, authorHandle);
    } else if (platform === 'instagram') {
      result = resolveInstagramPreview(externalVideoId, canonicalUrl);
    } else {
      result = {
        success: false,
        state: 'invalid_format',
        error: 'Plataforma no soportada',
      };
    }
  } catch (err: any) {
    console.error(`[oEmbed Error] Error processing preview for ${canonicalUrl}:`, err?.message || err);
    if (err?.status === 404 || err?.status === 401 || err?.status === 403) {
      result = {
        success: false,
        state: 'unavailable',
        message: 'No se pudo generar la vista previa. El enlace original puede registrarse igualmente.',
      };
    } else {
      result = {
        success: false,
        state: 'provider_error',
        message: 'Error temporal del proveedor. Puedes registrar el video con su enlace original.',
      };
    }
  }

  // Cache successful or definitive results (do not cache transient provider errors for long)
  if (result.state !== 'provider_error') {
    setCache(cacheKey, result);
  }

  return result;
}

/**
 * YouTube Preview Handler
 */
async function resolveYouTubePreview(
  videoId: string,
  canonicalUrl: string,
  authorHandle?: string
): Promise<VideoPreviewResult> {
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1`;
  const defaultThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const data = await fetchSafeJson(oembedUrl, 4000);

    return {
      success: true,
      state: 'ready',
      data: {
        platform: 'youtube',
        videoId,
        canonicalUrl,
        embedUrl,
        title: data?.title || 'Video de YouTube',
        authorName: data?.author_name || authorHandle || 'Canal de YouTube',
        authorUrl: data?.author_url || (authorHandle ? `https://www.youtube.com/@${authorHandle}` : undefined),
        thumbnailUrl: data?.thumbnail_url || defaultThumbnail,
        providerName: 'YouTube',
        width: typeof data?.width === 'number' ? data.width : 480,
        height: typeof data?.height === 'number' ? data.height : 270,
      },
    };
  } catch (err: any) {
    // If 404, the video is removed or private
    if (err?.status === 404) {
      return {
        success: false,
        state: 'unavailable',
        message: 'No se pudo generar la vista previa. El enlace original puede registrarse igualmente.',
      };
    }

    // On network glitch/timeout, fallback to clean standard YouTube embed and thumbnail
    return {
      success: true,
      state: 'ready',
      data: {
        platform: 'youtube',
        videoId,
        canonicalUrl,
        embedUrl,
        title: 'Video de YouTube',
        authorName: authorHandle ? `@${authorHandle}` : 'YouTube',
        thumbnailUrl: defaultThumbnail,
        providerName: 'YouTube',
        width: 480,
        height: 270,
      },
    };
  }
}

/**
 * TikTok Preview Handler (uses official oEmbed endpoint)
 */
async function resolveTikTokPreview(
  videoId: string,
  canonicalUrl: string,
  authorHandle?: string
): Promise<VideoPreviewResult> {
  // Official TikTok Embed Player URL
  const embedUrl = `https://www.tiktok.com/player/v1/${videoId}?music_info=1&description=1&autoplay=0`;

  try {
    const oembedEndpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`;
    const data = await fetchSafeJson(oembedEndpoint, 4500);

    const safeTitle = data?.title || 'Video turístico en TikTok';
    const safeAuthor = data?.author_name || (authorHandle ? `@${authorHandle}` : 'Creador de TikTok');
    const safeThumbnail = data?.thumbnail_url || undefined;

    return {
      success: true,
      state: 'ready',
      data: {
        platform: 'tiktok',
        videoId: data?.embed_product_id || videoId,
        canonicalUrl,
        embedUrl,
        title: safeTitle,
        authorName: safeAuthor,
        authorUrl: data?.author_url || (authorHandle ? `https://www.tiktok.com/@${authorHandle}` : undefined),
        thumbnailUrl: safeThumbnail,
        providerName: 'TikTok',
        width: 325,
        height: 578,
      },
    };
  } catch (err: any) {
    // If TikTok returns 404/not found or deleted
    if (err?.status === 404) {
      return {
        success: false,
        state: 'unavailable',
        message: 'No se pudo generar la vista previa. El enlace original puede registrarse igualmente.',
      };
    }

    // If we have a genuine numeric videoId, we can still render the official player safely
    if (/^\d{15,25}$/.test(videoId)) {
      return {
        success: true,
        state: 'ready',
        data: {
          platform: 'tiktok',
          videoId,
          canonicalUrl,
          embedUrl,
          title: 'Video de TikTok',
          authorName: authorHandle ? `@${authorHandle}` : 'TikTok',
          providerName: 'TikTok',
          width: 325,
          height: 578,
        },
      };
    }

    return {
      success: false,
      state: 'provider_error',
      message: 'Error temporal del proveedor. Puedes registrar el video con su enlace original.',
    };
  }
}

/**
 * Instagram Preview Handler
 * Formats official embed player safely with shortcode
 */
function resolveInstagramPreview(
  shortcode: string,
  canonicalUrl: string
): VideoPreviewResult {
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;

  return {
    success: true,
    state: 'ready',
    data: {
      platform: 'instagram',
      videoId: shortcode,
      canonicalUrl,
      embedUrl,
      title: `Publicación / Reel de Instagram (${shortcode})`,
      authorName: 'Instagram',
      providerName: 'Instagram',
      width: 400,
      height: 480,
    },
  };
}
