import { VideoSubmission } from '../types/creators.ts';
import { Place } from '../types/catalog.ts';
import { getLocality } from './geoBoundary.ts';
import { TikTokVideo } from '../components/common/TikTokVideoGallery.tsx';

export type VideoSubmissionWithPlaces = VideoSubmission & {
  places?: Place[];
};

/**
 * Resolves creator display text prioritizing handle (@username), display name, user name, or default label.
 * Never invents mock or random names.
 */
export function resolveCreatorLabel(video: VideoSubmission): string {
  if (video.creatorHandle && video.creatorHandle.trim().length > 0) {
    const cleanHandle = video.creatorHandle.trim().replace(/^@+/, '');
    return `@${cleanHandle}`;
  }
  if (video.creatorDisplayName && video.creatorDisplayName.trim().length > 0) {
    return video.creatorDisplayName.trim();
  }
  if (video.userName && video.userName.trim().length > 0) {
    return video.userName.trim();
  }
  return 'Creador de contenido';
}

/**
 * Resolves the primary place name associated with the video from the real regional catalog.
 */
export function resolvePlaceName(video: VideoSubmissionWithPlaces): string {
  if (video.places && video.places.length > 0 && video.places[0]?.name) {
    return video.places[0].name;
  }
  return 'La Libertad';
}

/**
 * Resolves official locality display name from the regional geographic boundaries.
 */
export function resolveLocalityName(video: VideoSubmissionWithPlaces): string {
  if (video.localityId) {
    const loc = getLocality(video.localityId);
    if (loc?.name) {
      return loc.name;
    }
  }
  if (video.places && video.places.length > 0 && video.places[0]?.localityName) {
    return video.places[0].localityName;
  }
  return 'La Libertad';
}

/**
 * Formats date into a localized readable format (e.g., '12 nov 2026').
 */
export function formatVideoDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Reciente';
    return d.toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Reciente';
  }
}

/**
 * Adapts an approved VideoSubmission from Neon PostgreSQL into a UI-ready TikTokVideo model.
 * Strictly separates real external social metrics (TikTok views/likes/comments) from
 * internal platform engagement (internalViews, internalSaves).
 * Never invents fake star ratings or random metrics.
 */
export function adaptVideoSubmissionToTikTokVideo(
  submission: VideoSubmissionWithPlaces
): TikTokVideo {
  const creator = resolveCreatorLabel(submission);
  const placeName = resolvePlaceName(submission);
  const locality = resolveLocalityName(submission);

  const hasExternalViews = typeof submission.externalMetrics?.views === 'number';
  const hasExternalLikes = typeof submission.externalMetrics?.likes === 'number';
  const hasExternalComments = typeof submission.externalMetrics?.comments === 'number';

  const externalViews = hasExternalViews ? (submission.externalMetrics?.views as number) : null;
  const externalLikes = hasExternalLikes ? (submission.externalMetrics?.likes as number) : null;
  const externalComments = hasExternalComments ? (submission.externalMetrics?.comments as number) : null;

  const internalViews = submission.internalViewsCount || 0;
  const internalSaves = submission.internalSavesCount || 0;

  return {
    id: submission.id,
    videoUrl: submission.videoUrl,
    title: submission.title,
    creator,
    placeName,
    category: submission.category || 'Destinos',
    thumbnailUrl: submission.thumbnailUrl || undefined,
    // Real external metrics
    externalViews,
    externalLikes,
    externalComments,
    // Real internal app metrics
    internalViews,
    internalSaves,
    // Legacy fields for backward compatibility with existing sorting/display
    views: externalViews ?? internalViews,
    likes: externalLikes ?? internalSaves,
    rating: 0, // No fake ratings
    updatedAt: formatVideoDate(submission.createdAt),
    demo: false,
    locality,
    department: 'La Libertad',
    platform: submission.platform,
    embedUrl: submission.embedUrl,
    places: (submission.places || []).map((p) => ({
      id: p.id,
      name: p.name,
      locality: p.localityName,
    })),
  };
}
