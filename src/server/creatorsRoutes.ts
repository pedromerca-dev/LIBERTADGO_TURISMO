/**
 * Creators Module Public & User API Routes
 * Endpoints:
 *   GET  /api/creators/videos
 *   GET  /api/creators/videos/:id
 *   POST /api/creators/submissions       (Auth required)
 *   GET  /api/creators/my-submissions    (Auth required)
 *   GET  /api/creators/profiles
 *   GET  /api/creators/profiles/:handle
 *   PUT  /api/creators/profile/me        (Auth required)
 *   POST /api/creators/videos/:id/save   (Auth required)
 *   GET  /api/places/:placeId/videos
 */

import { Router, Request, Response } from 'express';
import { SubmitVideoSchema, CreatorProfileSchema } from './creatorsSchemas.ts';
import { getCreatorsRepository } from './repositories/index.ts';
import { requireAuth } from './authService.ts';
import { parseAndValidateVideoUrl } from '../utils/videoUrlParser.ts';
import { INITIAL_PLACES } from '../data/initialPlaces.ts';
import { submissionRateLimiter, saveVideoRateLimiter, videoViewDeduplicator } from './rateLimiter.ts';

export const creatorsRouter = Router();

/**
 * Sanitizes moderation audit fields from public payloads to prevent data leakage.
 * Internal fields (moderationNotes, moderatedBy, moderatedAt) are only visible
 * to system administrators or the video's authenticated creator.
 */
function sanitizePublicVideo(video: any, req: Request) {
  if (!video) return video;
  const isAdmin = req.user?.role === 'ADMIN';
  const isAuthor = req.user?.userId === video.userId;
  if (isAdmin || isAuthor) {
    return video;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { moderationNotes, moderatedBy, moderatedAt, ...safe } = video;
  return safe;
}

// 1. GET /api/creators/videos - List approved videos with filters
creatorsRouter.get('/videos', async (req: Request, res: Response) => {
  const { localityId, category, contentType, platform, q, placeId, page, limit } = req.query;
  const repo = getCreatorsRepository();

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  try {
    const result = await repo.listApprovedVideos({
      localityId: typeof localityId === 'string' ? localityId : undefined,
      category: typeof category === 'string' ? category : undefined,
      contentType: typeof contentType === 'string' ? contentType : undefined,
      platform: typeof platform === 'string' ? platform : undefined,
      q: typeof q === 'string' ? q : undefined,
      placeId: typeof placeId === 'string' ? placeId : undefined,
      page: safePage,
      limit: safeLimit,
    });

    const sanitizedVideos = result.videos.map((v) => sanitizePublicVideo(v, req));

    res.json({
      success: true,
      data: sanitizedVideos,
      total: result.total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(result.total / safeLimit) || 1,
    });
  } catch (err) {
    console.error('[Creators Error] Error listing approved videos:', err);
    res.status(500).json({ success: false, error: 'Error al consultar videos aprobados' });
  }
});

// 1a. GET /api/creators/saved-videos & /api/creators/videos/saved - Authenticated user's bookmarked videos
const handleGetSavedVideos = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'No autorizado' });
    return;
  }

  const repo = getCreatorsRepository();
  try {
    const videos = await repo.listSavedVideosByUser(req.user.userId);
    const sanitized = videos.map((v) => sanitizePublicVideo(v, req));
    res.json({
      success: true,
      data: sanitized,
      total: sanitized.length,
    });
  } catch (err) {
    console.error('[Creators Error] Error listing saved videos:', err);
    res.status(500).json({ success: false, error: 'Error al consultar videos guardados' });
  }
};

creatorsRouter.get('/saved-videos', requireAuth, handleGetSavedVideos);
creatorsRouter.get('/videos/saved', requireAuth, handleGetSavedVideos);

// 2. GET /api/creators/videos/:id - Detail of an approved video
creatorsRouter.get('/videos/:id', async (req: Request, res: Response) => {
  const repo = getCreatorsRepository();

  try {
    const video = await repo.findSubmissionById(req.params.id);
    if (!video || (video.status !== 'APPROVED' && (!req.user || (req.user.role !== 'ADMIN' && req.user.userId !== video.userId)))) {
      res.status(404).json({ success: false, error: 'Video no encontrado o pendiente de aprobación' });
      return;
    }

    // Deduplicated internal view increment: only for APPROVED videos and not admin inspects
    if (video.status === 'APPROVED' && (!req.user || req.user.role !== 'ADMIN')) {
      if (videoViewDeduplicator.shouldIncrement(video.id, req)) {
        await repo.incrementInternalViews(video.id);
        video.internalViewsCount = (video.internalViewsCount || 0) + 1;
      }
    }

    const places = await repo.getPlacesForVideo(video.id);

    let isSaved = false;
    if (req.user) {
      isSaved = await repo.isSavedByUser(req.user.userId, video.id);
    }

    const sanitizedVideo = sanitizePublicVideo(video, req);

    res.json({
      success: true,
      data: {
        ...sanitizedVideo,
        places,
        isSaved,
      },
    });
  } catch (err) {
    console.error('[Creators Error] Error getting video detail:', err);
    res.status(500).json({ success: false, error: 'Error al obtener detalle del video' });
  }
});

// 3. POST /api/creators/submissions - Submit video (Auth required)
creatorsRouter.post('/submissions', requireAuth, submissionRateLimiter, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Autenticación requerida' });
    return;
  }

  const parseResult = SubmitVideoSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    res.status(400).json({ success: false, error: errorMsg });
    return;
  }

  const { videoUrl, title, description, contentType, category, localityId, thumbnailUrl, placeIds, primaryPlaceId } = parseResult.data;

  // Strict URL parse
  const parsed = parseAndValidateVideoUrl(videoUrl);
  if (!parsed.isValid || !parsed.data) {
    res.status(400).json({ success: false, error: parsed.error || 'URL no soportada' });
    return;
  }

  const repo = getCreatorsRepository();

  try {
    // Duplicate prevention: check platform + externalVideoId
    const existing = await repo.findSubmissionByPlatformAndExternalId(
      parsed.data.platform,
      parsed.data.externalVideoId
    );

    if (existing) {
      if (existing.status === 'APPROVED') {
        res.status(409).json({
          success: false,
          error: 'Este video ya se encuentra publicado y aprobado en LibertadGO.',
        });
        return;
      }
      if (existing.status === 'PENDING') {
        res.status(409).json({
          success: false,
          error: 'Este video ya ha sido enviado y se encuentra en revisión en la bandeja de moderación.',
        });
        return;
      }
    }

    // Verify places exist in tourist directory
    const invalidPlaceIds = placeIds.filter((pId) =>
      !INITIAL_PLACES.some((p) => p.id === pId)
    );
    if (invalidPlaceIds.length > 0) {
      res.status(400).json({
        success: false,
        error: `Los siguientes lugares no existen en el catálogo turístico: ${invalidPlaceIds.join(', ')}`,
      });
      return;
    }

    const uniquePlaceIds = Array.from(new Set(placeIds));
    if (primaryPlaceId && uniquePlaceIds.length > 0 && !uniquePlaceIds.includes(primaryPlaceId)) {
      res.status(400).json({
        success: false,
        error: 'El lugar principal debe pertenecer a la lista de lugares asociados',
      });
      return;
    }

    // Get creator profile if user has one
    const profile = await repo.findCreatorProfileByUserId(req.user.userId);

    const submission = await repo.createSubmission(
      {
        userId: req.user.userId,
        creatorProfileId: profile ? profile.id : null,
        platform: parsed.data.platform,
        externalVideoId: parsed.data.externalVideoId,
        videoUrl: parsed.data.canonicalUrl,
        embedUrl: parsed.data.embedUrl,
        thumbnailUrl: thumbnailUrl || null,
        title,
        description: description || null,
        contentType,
        category,
        localityId: localityId || null,
        externalCreatorHandle: (!profile && parsed.data.authorHandle) ? parsed.data.authorHandle : null,
      },
      uniquePlaceIds,
      primaryPlaceId || (uniquePlaceIds[0] || null)
    );

    res.status(201).json({
      success: true,
      data: submission,
      message: 'Video enviado exitosamente. Tu publicación está en revisión por el equipo de moderación.',
    });
  } catch (err) {
    console.error('[Creators Error] Error submitting video:', err);
    res.status(500).json({ success: false, error: 'Error interno al enviar la publicación' });
  }
});

// 4. GET /api/creators/my-submissions - User's submission history
creatorsRouter.get('/my-submissions', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'No autorizado' });
    return;
  }

  const repo = getCreatorsRepository();
  try {
    const submissions = await repo.listSubmissionsByUser(req.user.userId);
    res.json({ success: true, data: submissions });
  } catch (err) {
    console.error('[Creators Error] Error getting my submissions:', err);
    res.status(500).json({ success: false, error: 'Error al consultar tus publicaciones' });
  }
});

// 5. GET /api/creators/profiles - List public creators
creatorsRouter.get('/profiles', async (_req: Request, res: Response) => {
  const repo = getCreatorsRepository();
  try {
    const profiles = await repo.listPublicCreators();
    res.json({ success: true, data: profiles });
  } catch (err) {
    console.error('[Creators Error] Error listing creators:', err);
    res.status(500).json({ success: false, error: 'Error al consultar perfiles de creadores' });
  }
});

// 6. GET /api/creators/profiles/:handle - Public creator detail
creatorsRouter.get('/profiles/:handle', async (req: Request, res: Response) => {
  const repo = getCreatorsRepository();
  try {
    const profile = await repo.findCreatorProfileByHandle(req.params.handle);
    if (!profile || !profile.isPublic) {
      res.status(404).json({ success: false, error: 'Perfil de creador no encontrado o privado' });
      return;
    }

    const videos = await repo.listSubmissionsByUser(profile.userId);
    const approvedVideos = videos.filter((v) => v.status === 'APPROVED');

    res.json({
      success: true,
      data: {
        profile,
        videos: approvedVideos,
      },
    });
  } catch (err) {
    console.error('[Creators Error] Error getting creator profile:', err);
    res.status(500).json({ success: false, error: 'Error al consultar el perfil' });
  }
});

// 7. PUT /api/creators/profile/me - Create/update my creator profile
creatorsRouter.put('/profile/me', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'No autorizado' });
    return;
  }

  const parseResult = CreatorProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    res.status(400).json({ success: false, error: errorMsg });
    return;
  }

  const repo = getCreatorsRepository();
  try {
    // Check if handle is taken by another user
    const existingWithHandle = await repo.findCreatorProfileByHandle(parseResult.data.handle);
    if (existingWithHandle && existingWithHandle.userId !== req.user.userId) {
      res.status(409).json({
        success: false,
        error: 'El identificador @handle ya se encuentra en uso por otro creador',
      });
      return;
    }

    const profile = await repo.saveCreatorProfile({
      userId: req.user.userId,
      ...parseResult.data,
    });

    res.json({
      success: true,
      data: profile,
      message: 'Perfil de creador actualizado con éxito',
    });
  } catch (err) {
    console.error('[Creators Error] Error saving creator profile:', err);
    res.status(500).json({ success: false, error: 'Error al actualizar perfil de creador' });
  }
});

// 8. POST /api/creators/videos/:id/save - Toggle bookmark
creatorsRouter.post('/videos/:id/save', requireAuth, saveVideoRateLimiter, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'No autorizado' });
    return;
  }

  const repo = getCreatorsRepository();
  try {
    const video = await repo.findSubmissionById(req.params.id);
    if (!video || (video.status !== 'APPROVED' && (!req.user || (req.user.role !== 'ADMIN' && req.user.userId !== video.userId)))) {
      res.status(404).json({ success: false, error: 'Video no encontrado o no disponible para guardar' });
      return;
    }

    const result = await repo.toggleSaveVideo(req.user.userId, req.params.id);
    res.json({ success: true, saved: result.saved });
  } catch (err: any) {
    if (err?.message?.includes('no encontrado') || err?.message?.includes('no disponible')) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    console.error('[Creators Error] Error saving video:', err);
    res.status(500).json({ success: false, error: 'Error al guardar video en favoritos' });
  }
});

// 9. GET /api/places/:placeId/videos - Approved videos for a specific tourist establishment
creatorsRouter.get('/places/:placeId/videos', async (req: Request, res: Response) => {
  const repo = getCreatorsRepository();
  try {
    const videos = await repo.getVideosForPlace(req.params.placeId);
    const sanitizedVideos = videos.map((v) => sanitizePublicVideo(v, req));
    res.json({
      success: true,
      data: sanitizedVideos,
      total: sanitizedVideos.length,
      placeId: req.params.placeId,
    });
  } catch (err) {
    console.error('[Creators Error] Error getting place videos:', err);
    res.status(500).json({ success: false, error: 'Error al consultar videos del establecimiento' });
  }
});
