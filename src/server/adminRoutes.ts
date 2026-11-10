/**
 * Administrative Moderation API Routes for LibertadGO (/api/admin/*)
 * Strictly protected with requireAuth and requireAdmin middleware.
 * Zero trust: Every administrative mutation is verified on the backend and logged in VideoModerationLog.
 */

import { Router, Request, Response } from 'express';
import { ModerationActionSchema } from './creatorsSchemas.ts';
import { getCreatorsRepository } from './repositories/index.ts';
import { requireAuth, requireAdmin } from './authService.ts';
import { ModerationStatus } from '../types/creators.ts';
import { INITIAL_PLACES } from '../data/initialPlaces.ts';

export const adminRouter = Router();

// Apply admin guards to all routes in this router
adminRouter.use(requireAuth, requireAdmin);

// 1. GET /api/admin/metrics - Overview statistics
adminRouter.get('/metrics', async (_req: Request, res: Response) => {
  const repo = getCreatorsRepository();
  try {
    const metrics = await repo.getAdminMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Admin Error] Error fetching admin metrics:', err);
    res.status(500).json({ success: false, error: 'Error al consultar métricas del sistema' });
  }
});

// 2. GET /api/admin/moderation/queue - Moderation queue
adminRouter.get('/moderation/queue', async (req: Request, res: Response) => {
  const repo = getCreatorsRepository();
  const statusFilter = (req.query.status as ModerationStatus) || 'PENDING';

  try {
    const queue = await repo.listModerationQueue(statusFilter);

    // Enrich with place names for quick admin inspection
    const enriched = await Promise.all(
      queue.map(async (v) => {
        const places = await repo.getPlacesForVideo(v.id);
        return {
          ...v,
          places,
        };
      })
    );

    res.json({
      success: true,
      data: enriched,
      count: enriched.length,
      status: statusFilter,
    });
  } catch (err) {
    console.error('[Admin Error] Error fetching moderation queue:', err);
    res.status(500).json({ success: false, error: 'Error al consultar la bandeja de moderación' });
  }
});

// 3. POST /api/admin/moderation/:id/action - Execute moderation action
adminRouter.post('/moderation/:id/action', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'No autorizado' });
    return;
  }

  const parseResult = ModerationActionSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    res.status(400).json({ success: false, error: errorMsg });
    return;
  }

  const { action, reason, internalNotes, verifiedPlaceIds } = parseResult.data;
  const repo = getCreatorsRepository();

  try {
    const submission = await repo.findSubmissionById(req.params.id);
    if (!submission) {
      res.status(404).json({ success: false, error: 'Publicación no encontrada' });
      return;
    }

    const previousStatus = submission.status;
    const actionToStatusMap: Record<'APPROVE' | 'REJECT' | 'OBSERVE' | 'HIDE', ModerationStatus> = {
      APPROVE: 'APPROVED',
      REJECT: 'REJECTED',
      OBSERVE: 'OBSERVED',
      HIDE: 'HIDDEN',
    };
    const newStatus: ModerationStatus = actionToStatusMap[action];

    // If verified places are provided by admin, update associations
    if (verifiedPlaceIds && Array.isArray(verifiedPlaceIds)) {
      const validIds = verifiedPlaceIds.filter((pId) =>
        INITIAL_PLACES.some((p) => p.id === pId)
      );
      await repo.associatePlaces(submission.id, validIds);
    }

    // Update status
    const updated = await repo.updateSubmissionStatus(
      submission.id,
      newStatus,
      reason || null,
      req.user.userId
    );

    // Record immutable audit log
    await repo.addModerationLog({
      videoId: submission.id,
      adminUserId: req.user.userId,
      adminName: req.user.name,
      previousStatus,
      newStatus,
      reason: reason || null,
      internalNotes: internalNotes || null,
    });

    res.json({
      success: true,
      data: updated,
      message: `Publicación moderada con éxito. Estado: ${newStatus}`,
    });
  } catch (err) {
    console.error('[Admin Error] Error performing moderation action:', err);
    res.status(500).json({ success: false, error: 'Error interno al procesar acción de moderación' });
  }
});

// 4. GET /api/admin/moderation/:id/history - Audit trail
adminRouter.get('/moderation/:id/history', async (req: Request, res: Response) => {
  const repo = getCreatorsRepository();
  try {
    const logs = await repo.getModerationLogs(req.params.id);
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('[Admin Error] Error fetching moderation logs:', err);
    res.status(500).json({ success: false, error: 'Error al consultar historial de moderación' });
  }
});

// 5. PUT /api/admin/moderation/:id/places - Link/unlink tourist directory places
adminRouter.put('/moderation/:id/places', async (req: Request, res: Response) => {
  const { placeIds, primaryPlaceId } = req.body;
  if (!Array.isArray(placeIds)) {
    res.status(400).json({ success: false, error: 'placeIds debe ser un array de identificadores' });
    return;
  }

  const repo = getCreatorsRepository();
  try {
    const validIds = placeIds.filter((pId) =>
      INITIAL_PLACES.some((p) => p.id === pId)
    );

    await repo.associatePlaces(req.params.id, validIds, primaryPlaceId);
    const updatedPlaces = await repo.getPlacesForVideo(req.params.id);

    res.json({
      success: true,
      data: updatedPlaces,
      message: 'Lugares vinculados actualizados correctamente',
    });
  } catch (err) {
    console.error('[Admin Error] Error updating linked places:', err);
    res.status(500).json({ success: false, error: 'Error al actualizar lugares asociados' });
  }
});

// =========================================================================
// CATALOG ADMINISTRATION: PLACES, CATEGORIES, LOCALITIES, DUPLICATES, AUDIT
// =========================================================================

import { getPlaceRepository } from './repositories/placeRepository.ts';
import {
  CreatePlaceSchema,
  UpdatePlaceSchema,
  UpdatePlaceStatusSchema,
  VerifyPlaceSchema,
  MergeDuplicatesSchema,
} from './placesSchemas.ts';
import { PlaceStatus } from '../types/adminCatalog.ts';

// 6. GET /api/admin/dashboard - Comprehensive system indicators
adminRouter.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const repo = getPlaceRepository();
    const metrics = await repo.getDashboardMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Admin Error] Error fetching admin dashboard metrics:', err);
    res.status(500).json({ success: false, error: 'Error al generar indicadores del panel administrativo' });
  }
});

// 7. GET /api/admin/places - List places with filters and pagination
adminRouter.get('/places', async (req: Request, res: Response) => {
  try {
    const {
      search,
      status,
      category,
      localityId,
      isVerified,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const repo = getPlaceRepository();
    const result = await repo.listPlaces({
      search: typeof search === 'string' ? search : undefined,
      status: typeof status === 'string' ? (status as PlaceStatus | 'ALL') : undefined,
      category: typeof category === 'string' ? (category as any) : undefined,
      localityId: typeof localityId === 'string' ? localityId : undefined,
      isVerified:
        isVerified === 'true'
          ? true
          : isVerified === 'false'
          ? false
          : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
      sortBy: typeof sortBy === 'string' ? (sortBy as any) : 'updatedAt',
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
    });

    res.json({
      success: true,
      data: result.places,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  } catch (err) {
    console.error('[Admin Error] Error listing places:', err);
    res.status(500).json({ success: false, error: 'Error al consultar catálogo administrativo' });
  }
});

// 8. GET /api/admin/places/:id - Single place details with full relations
adminRouter.get('/places/:id', async (req: Request, res: Response) => {
  try {
    const repo = getPlaceRepository();
    const place = await repo.getPlaceById(req.params.id);
    if (!place) {
      res.status(404).json({ success: false, error: 'Lugar no encontrado en el catálogo' });
      return;
    }

    const history = await repo.getAuditLogs(place.id, 20);

    res.json({
      success: true,
      data: {
        ...place,
        auditHistory: history,
      },
    });
  } catch (err) {
    console.error('[Admin Error] Error fetching place details:', err);
    res.status(500).json({ success: false, error: 'Error al consultar detalle del lugar' });
  }
});

// 9. POST /api/admin/places - Create new place
adminRouter.post('/places', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'No autorizado' });
    return;
  }

  const parseResult = CreatePlaceSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    res.status(400).json({ success: false, error: errorMsg });
    return;
  }

  try {
    const repo = getPlaceRepository();
    const created = await repo.createPlace(parseResult.data as any, req.user.userId, req.user.name);
    res.status(201).json({
      success: true,
      data: created,
      message: `Lugar "${created.name}" creado exitosamente`,
    });
  } catch (err) {
    console.error('[Admin Error] Error creating place:', err);
    res.status(500).json({ success: false, error: 'Error al crear lugar en el catálogo' });
  }
});

// 10. PUT /api/admin/places/:id - Full place update
adminRouter.put('/places/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'No autorizado' });
    return;
  }

  const parseResult = UpdatePlaceSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    res.status(400).json({ success: false, error: errorMsg });
    return;
  }

  try {
    const repo = getPlaceRepository();
    const updated = await repo.updatePlace(
      req.params.id,
      parseResult.data as any,
      req.user.userId,
      req.user.name,
      req.body.changeSummary
    );

    if (!updated) {
      res.status(404).json({ success: false, error: 'Lugar no encontrado para actualizar' });
      return;
    }

    res.json({
      success: true,
      data: updated,
      message: `Lugar "${updated.name}" actualizado exitosamente`,
    });
  } catch (err) {
    console.error('[Admin Error] Error updating place:', err);
    res.status(500).json({ success: false, error: 'Error al actualizar lugar' });
  }
});

// 11. PATCH /api/admin/places/:id/status - Change place status
adminRouter.patch('/places/:id/status', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'No autorizado' });
    return;
  }

  const parseResult = UpdatePlaceStatusSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    res.status(400).json({ success: false, error: errorMsg });
    return;
  }

  try {
    const repo = getPlaceRepository();
    const updated = await repo.updateStatus(
      req.params.id,
      parseResult.data.status,
      req.user.userId,
      req.user.name,
      parseResult.data.reason
    );

    if (!updated) {
      res.status(404).json({ success: false, error: 'Lugar no encontrado' });
      return;
    }

    res.json({
      success: true,
      data: updated,
      message: `Estado de "${updated.name}" cambiado a ${parseResult.data.status}`,
    });
  } catch (err) {
    console.error('[Admin Error] Error changing place status:', err);
    res.status(500).json({ success: false, error: 'Error al actualizar estado del lugar' });
  }
});

// 12. PATCH /api/admin/places/:id/verify - Update verification
adminRouter.patch('/places/:id/verify', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'No autorizado' });
    return;
  }

  const parseResult = VerifyPlaceSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    res.status(400).json({ success: false, error: errorMsg });
    return;
  }

  try {
    const repo = getPlaceRepository();
    const updated = await repo.verifyPlace(
      req.params.id,
      parseResult.data.isVerified,
      parseResult.data.verificationLevel,
      parseResult.data.notes,
      req.user.userId,
      req.user.name
    );

    if (!updated) {
      res.status(404).json({ success: false, error: 'Lugar no encontrado' });
      return;
    }

    res.json({
      success: true,
      data: updated,
      message: `Verificación de "${updated.name}" actualizada con éxito`,
    });
  } catch (err) {
    console.error('[Admin Error] Error verifying place:', err);
    res.status(500).json({ success: false, error: 'Error al actualizar verificación' });
  }
});

// 13. GET /api/admin/categories - Category statistics
adminRouter.get('/categories', async (_req: Request, res: Response) => {
  try {
    const repo = getPlaceRepository();
    const stats = await repo.getCategoriesStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('[Admin Error] Error fetching categories stats:', err);
    res.status(500).json({ success: false, error: 'Error al consultar categorías' });
  }
});

// 14. GET /api/admin/localities - Locality statistics
adminRouter.get('/localities', async (_req: Request, res: Response) => {
  try {
    const repo = getPlaceRepository();
    const stats = await repo.getLocalitiesStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('[Admin Error] Error fetching localities stats:', err);
    res.status(500).json({ success: false, error: 'Error al consultar localidades' });
  }
});

// 15. GET /api/admin/sources - Sources statistics
adminRouter.get('/sources', async (_req: Request, res: Response) => {
  try {
    const repo = getPlaceRepository();
    const stats = await repo.getSourcesStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('[Admin Error] Error fetching sources stats:', err);
    res.status(500).json({ success: false, error: 'Error al consultar fuentes de datos' });
  }
});

// 16. GET /api/admin/duplicates - Potential duplicates detection
adminRouter.get('/duplicates', async (_req: Request, res: Response) => {
  try {
    const repo = getPlaceRepository();
    const duplicates = await repo.findDuplicates();
    res.json({
      success: true,
      data: duplicates,
      total: duplicates.length,
    });
  } catch (err) {
    console.error('[Admin Error] Error detecting duplicates:', err);
    res.status(500).json({ success: false, error: 'Error al identificar duplicados' });
  }
});

// 17. POST /api/admin/duplicates/merge - Merge duplicates into primary place
adminRouter.post('/duplicates/merge', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'No autorizado' });
    return;
  }

  const parseResult = MergeDuplicatesSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    res.status(400).json({ success: false, error: errorMsg });
    return;
  }

  try {
    const repo = getPlaceRepository();
    const result = await repo.mergeDuplicates(
      parseResult.data.primaryId,
      parseResult.data.duplicateIds,
      req.user.userId,
      req.user.name
    );

    res.json({
      success: true,
      data: result.primaryPlace,
      mergedCount: result.mergedCount,
      message: `Fusión completada: ${result.mergedCount} lugar(es) fusionado(s) exitosamente`,
    });
  } catch (err) {
    console.error('[Admin Error] Error merging duplicates:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error al fusionar lugares duplicados',
    });
  }
});

// 18. GET /api/admin/audit - Immutable audit trail
adminRouter.get('/audit', async (req: Request, res: Response) => {
  try {
    const repo = getPlaceRepository();
    const placeId = typeof req.query.placeId === 'string' ? req.query.placeId : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const logs = await repo.getAuditLogs(placeId, limit);
    res.json({
      success: true,
      data: logs,
      total: logs.length,
    });
  } catch (err) {
    console.error('[Admin Error] Error fetching audit trail:', err);
    res.status(500).json({ success: false, error: 'Error al consultar registro de auditoría' });
  }
});

// 19. GET /api/admin/places/:id/history - Audit logs for specific place
adminRouter.get('/places/:id/history', async (req: Request, res: Response) => {
  try {
    const repo = getPlaceRepository();
    const logs = await repo.getAuditLogs(req.params.id, 50);
    res.json({
      success: true,
      data: logs,
      placeId: req.params.id,
    });
  } catch (err) {
    console.error('[Admin Error] Error fetching place history:', err);
    res.status(500).json({ success: false, error: 'Error al consultar historial del lugar' });
  }
});

