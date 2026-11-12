/**
 * URL Parser and Platform Normalizer for LibertadGO Creators Module
 * Strict validation and official embed generator for TikTok, Instagram, and YouTube.
 * Security: Prevents SSRF, URL injection, and unverified domains.
 */

import { VideoPlatform } from '../types/creators.ts';

export interface ParsedVideoUrl {
  platform: VideoPlatform;
  externalVideoId: string;
  canonicalUrl: string;
  embedUrl: string;
  authorHandle?: string;
}

export interface ParseResult {
  isValid: boolean;
  error?: string;
  data?: ParsedVideoUrl;
}

export function parseAndValidateVideoUrl(rawUrl: string): ParseResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'La URL del video es obligatoria' };
  }

  const trimmed = rawUrl.trim();

  // Basic URL structure check
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return { isValid: false, error: 'La URL proporcionada no tiene un formato válido' };
  }

  // Enforce HTTPS
  if (parsedUrl.protocol !== 'https:') {
    return { isValid: false, error: 'Por seguridad, solo se permiten enlaces seguros con HTTPS' };
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');
  const pathname = parsedUrl.pathname;

  // 1. YOUTUBE PARSING
  // Formats: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, youtube.com/embed/ID, youtube.com/@handle/shorts/ID
  if (hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'youtu.be') {
    let videoId: string | null = null;
    let authorHandle: string | undefined = undefined;

    const ytAuthorMatch = pathname.match(/\/@([a-zA-Z0-9_.-]+)/);
    if (ytAuthorMatch && ytAuthorMatch[1]) {
      authorHandle = ytAuthorMatch[1];
    }

    if (hostname === 'youtu.be') {
      videoId = pathname.slice(1).split('/')[0].split('?')[0];
    } else if (pathname.startsWith('/watch')) {
      videoId = parsedUrl.searchParams.get('v');
    } else if (pathname.includes('/shorts/')) {
      const parts = pathname.split('/shorts/');
      videoId = parts[1]?.split('/')[0]?.split('?')[0] || null;
    } else if (pathname.startsWith('/embed/')) {
      const parts = pathname.split('/');
      videoId = parts[2] || null;
    }

    if (!videoId || !/^[a-zA-Z0-9_-]{10,14}$/.test(videoId)) {
      return {
        isValid: false,
        error: 'El enlace de YouTube no contiene un identificador de video válido',
      };
    }

    return {
      isValid: true,
      data: {
        platform: 'youtube',
        externalVideoId: videoId,
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        authorHandle,
      },
    };
  }

  // 2. TIKTOK PARSING
  // Formats: tiktok.com/@username/video/ID, vt.tiktok.com/ID, vm.tiktok.com/ID
  if (hostname === 'tiktok.com' || hostname === 'm.tiktok.com' || hostname === 'vt.tiktok.com' || hostname === 'vm.tiktok.com') {
    const tiktokAuthorMatch = pathname.match(/\/@([a-zA-Z0-9_.-]+)/);
    const authorHandle = tiktokAuthorMatch ? tiktokAuthorMatch[1] : undefined;

    // Standard video URL: /@user/video/1234567890123456789
    const videoMatch = pathname.match(/\/video\/(\d{15,25})/);
    if (videoMatch && videoMatch[1]) {
      const videoId = videoMatch[1];
      return {
        isValid: true,
        data: {
          platform: 'tiktok',
          externalVideoId: videoId,
          canonicalUrl: `https://www.tiktok.com${pathname.split('?')[0]}`,
          embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`,
          authorHandle,
        },
      };
    }

    // Short links (vt.tiktok.com/ABC, vm.tiktok.com/ABC, or tiktok.com/t/ABC)
    if (hostname === 'vt.tiktok.com' || hostname === 'vm.tiktok.com' || (hostname === 'tiktok.com' && pathname.startsWith('/t/'))) {
      const shortCode = pathname.replace(/^\/+t\/?|^\/+/, '').split('/')[0].split('?')[0];
      if (/^[a-zA-Z0-9_-]{5,15}$/.test(shortCode)) {
        return {
          isValid: true,
          data: {
            platform: 'tiktok',
            externalVideoId: `short_${shortCode}`,
            canonicalUrl: hostname === 'tiktok.com' ? `https://www.tiktok.com/t/${shortCode}` : `https://${hostname}/${shortCode}`,
            embedUrl: `https://www.tiktok.com/player/v1/${shortCode}?music_info=1&description=1&autoplay=0`,
          },
        };
      }
    }

    return {
      isValid: false,
      error: 'Formato de enlace de TikTok no reconocido. Utiliza el enlace directo del video (ej. tiktok.com/@usuario/video/...)',
    };
  }

  // 3. INSTAGRAM REELS / POSTS PARSING
  // Formats: instagram.com/reel/ID, instagram.com/reels/ID, instagram.com/p/ID
  if (hostname === 'instagram.com') {
    const reelMatch = pathname.match(/\/(reel|reels|p)\/([a-zA-Z0-9_-]+)/);
    if (reelMatch && reelMatch[2]) {
      const shortcode = reelMatch[2];
      return {
        isValid: true,
        data: {
          platform: 'instagram',
          externalVideoId: shortcode,
          canonicalUrl: `https://www.instagram.com/reel/${shortcode}/`,
          embedUrl: `https://www.instagram.com/p/${shortcode}/embed`,
        },
      };
    }

    return {
      isValid: false,
      error: 'Formato de enlace de Instagram no reconocido. Utiliza enlaces de tipo /reel/ o /p/',
    };
  }

  return {
    isValid: false,
    error: 'Plataforma no soportada. Solo se admiten enlaces de TikTok, Instagram y YouTube.',
  };
}
