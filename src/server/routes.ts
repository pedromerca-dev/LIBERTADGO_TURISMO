import { Router, Request, Response } from 'express';
import { catalogRepository } from './repository.ts';
import { INITIAL_EVENTS } from '../data/initialEvents.ts';
import { CreateTripSchema } from './schemas.ts';
import { authRouter } from './authRoutes.ts';
import { creatorsRouter } from './creatorsRoutes.ts';
import { adminRouter } from './adminRoutes.ts';
import { authMiddleware } from './authService.ts';

import { checkDatabaseHealth } from './repositories/index.ts';

export const apiRouter = Router();

// GET /api/health - Public health check returning application/json status
apiRouter.get('/health', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  const dbHealth = await checkDatabaseHealth();
  res.json({
    status: dbHealth.connected ? 'healthy' : 'degraded',
    database: dbHealth.connected ? 'connected' : 'not_configured',
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    timestamp: new Date().toISOString(),
  });
});

// Apply auth token parser across all /api routes
apiRouter.use(authMiddleware);

// Mount Creators & Auth Sub-Routers
apiRouter.use('/auth', authRouter);
apiRouter.use('/creators', creatorsRouter);
apiRouter.use('/admin', adminRouter);

// GET /api/destinations
apiRouter.get('/destinations', (_req: Request, res: Response) => {
  const destinations = catalogRepository.getDestinations();
  res.json({
    success: true,
    data: destinations,
    region: 'La Libertad, Perú',
    total: destinations.length,
  });
});

// GET /api/destinations/:id
apiRouter.get('/destinations/:id', (req: Request, res: Response) => {
  const dest = catalogRepository.getDestinationById(req.params.id);
  if (!dest) {
    res.status(404).json({ success: false, error: 'Destino no encontrado en La Libertad' });
    return;
  }
  res.json({ success: true, data: dest });
});

// GET /api/events - Cultural & tourist events in La Libertad
apiRouter.get('/events', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: INITIAL_EVENTS,
    total: INITIAL_EVENTS.length,
    region: 'La Libertad, Perú',
  });
});

// GET /api/places
apiRouter.get('/places', (req: Request, res: Response) => {
  const { localityId, category, q, page, limit } = req.query;
  const places = catalogRepository.getPlaces({
    localityId: typeof localityId === 'string' ? localityId : undefined,
    category: typeof category === 'string' ? category : undefined,
    search: typeof q === 'string' ? q : undefined,
  });

  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 50));
  const total = places.length;
  const startIndex = (pageNum - 1) * pageSize;
  const paginated = limit ? places.slice(startIndex, startIndex + pageSize) : places;

  res.json({
    success: true,
    data: paginated,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / pageSize),
    regionConstraint: 'La Libertad',
    sources: ['MINCETUR', 'OpenStreetMap', 'Directorio_Oficial_La_Libertad'],
  });
});

// GET /api/places/search
apiRouter.get('/places/search', (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const localityId = typeof req.query.localityId === 'string' ? req.query.localityId : undefined;

  const places = catalogRepository.searchPlaces(q, localityId);
  res.json({
    success: true,
    data: places,
    total: places.length,
  });
});

// GET /api/places/:id/videos - Approved videos associated with a specific place
apiRouter.get('/places/:id/videos', async (req: Request, res: Response) => {
  try {
    const { getCreatorsRepository } = await import('./repositories/index.ts');
    const repo = getCreatorsRepository();
    const videos = await repo.getVideosForPlace(req.params.id);
    res.json({
      success: true,
      data: videos,
      total: videos.length,
      placeId: req.params.id,
    });
  } catch (err) {
    console.error('[Places Error] Error getting place videos:', err);
    res.status(500).json({ success: false, error: 'Error al consultar videos del lugar' });
  }
});

// GET /api/places/:id
apiRouter.get('/places/:id', (req: Request, res: Response) => {
  const place = catalogRepository.getPlaceById(req.params.id);
  if (!place) {
    res.status(404).json({ success: false, error: 'Lugar no encontrado en el catálogo de La Libertad' });
    return;
  }
  res.json({ success: true, data: place });
});

// GET /api/route - Real-world street routing via OpenStreetMap / OSRM
apiRouter.get('/route', async (req: Request, res: Response) => {
  const coordinates = typeof req.query.coordinates === 'string' ? req.query.coordinates.trim() : '';
  if (!coordinates || !coordinates.includes(';')) {
    res.status(400).json({
      success: false,
      error: 'Se requieren al menos 2 coordenadas separadas por punto y coma (ej. lng1,lat1;lng2,lat2)',
    });
    return;
  }

  // Validate format
  const pairs = coordinates.split(';');
  const isValidFormat = pairs.every((p) => {
    const [lng, lat] = p.split(',').map(Number);
    return !isNaN(lng) && !isNaN(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  });

  if (!isValidFormat) {
    res.status(400).json({
      success: false,
      error: 'Formato de coordenadas inválido. Debe ser longitud,latitud numérico.',
    });
    return;
  }

  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const osrmResponse = await fetch(osrmUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LibertadGO-Turismo-LaLibertad/1.0',
      },
    });
    clearTimeout(timeout);

    if (!osrmResponse.ok) {
      res.status(502).json({
        success: false,
        error: 'El servicio de enrutamiento OSRM no respondió correctamente.',
      });
      return;
    }

    const data = await osrmResponse.json();
    if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
      const best = data.routes[0];
      const distanceMeters = Math.round(best.distance || 0);
      const durationSeconds = Math.round(best.duration || 0);

      const distanceFormatted =
        distanceMeters < 1000
          ? `${distanceMeters} m`
          : `${(distanceMeters / 1000).toFixed(1)} km`;

      const minutes = Math.round(durationSeconds / 60);
      const durationFormatted =
        minutes < 60
          ? `${Math.max(1, minutes)} min`
          : `${Math.floor(minutes / 60)} h ${minutes % 60 > 0 ? `${minutes % 60} min` : ''}`.trim();

      res.json({
        success: true,
        route: {
          coordinates: best.geometry?.coordinates || [],
          distanceMeters,
          durationSeconds,
          distanceFormatted,
          durationFormatted,
          provider: 'OSRM / OpenStreetMap',
        },
      });
      return;
    }

    res.status(404).json({
      success: false,
      error: 'Recorrido vial aún no disponible para este tramo.',
    });
  } catch (err) {
    console.warn('[Routing] Error querying OSRM:', err instanceof Error ? err.message : String(err));
    res.status(503).json({
      success: false,
      error: 'Servicio de cálculo de rutas no disponible temporalmente.',
    });
  }
});

// POST /api/itineraries
apiRouter.post('/itineraries', (req: Request, res: Response) => {
  const parseResult = CreateTripSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((e: { message: string }) => e.message).join(', ');
    res.status(400).json({ success: false, error: errorMsg });
    return;
  }

  const { destinationId, startDate, endDate, title } = parseResult.data;
  const result = catalogRepository.createItinerary({
    destinationId,
    startDate,
    endDate,
    title,
  });

  if (result.error || !result.itinerary) {
    res.status(400).json({ success: false, error: result.error || 'Error al crear itinerario' });
    return;
  }

  res.status(201).json({ success: true, data: result.itinerary });
});

// GET /api/itineraries/:id
apiRouter.get('/itineraries/:id', (req: Request, res: Response) => {
  const itinerary = catalogRepository.getItineraryById(req.params.id);
  if (!itinerary) {
    res.status(404).json({ success: false, error: 'Itinerario no encontrado' });
    return;
  }
  res.json({ success: true, data: itinerary });
});

// POST /api/itineraries/:id/activities
apiRouter.post('/itineraries/:id/activities', (req: Request, res: Response) => {
  const { placeId, dayNumber, timeSlot, notes } = req.body;
  if (!placeId || typeof dayNumber !== 'number') {
    res.status(400).json({ success: false, error: 'placeId y dayNumber son obligatorios' });
    return;
  }

  const result = catalogRepository.addActivity(req.params.id, {
    placeId,
    dayNumber,
    timeSlot,
    notes,
  });

  if (result.error || !result.activity) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }

  res.status(201).json({ success: true, data: result.activity });
});

// DELETE /api/itineraries/:id/activities/:activityId
apiRouter.delete('/itineraries/:id/activities/:activityId', (req: Request, res: Response) => {
  const success = catalogRepository.removeActivity(req.params.id, req.params.activityId);
  if (!success) {
    res.status(404).json({ success: false, error: 'Actividad o itinerario no encontrado' });
    return;
  }
  res.json({ success: true, message: 'Actividad eliminada' });
});

// =========================================================================
// PAQUETE PARA LOCALES & CREADORES: CAMPAÑAS Y CONCURSO DE VIDEOS (TOP 3)
// =========================================================================

// GET /api/campaigns
apiRouter.get('/campaigns', (req: Request, res: Response) => {
  const { localityId, q, startDate, endDate } = req.query;
  const campaigns = catalogRepository.getCampaigns({
    localityId: typeof localityId === 'string' ? localityId : undefined,
    search: typeof q === 'string' ? q : undefined,
    startDate: typeof startDate === 'string' ? startDate : undefined,
    endDate: typeof endDate === 'string' ? endDate : undefined,
  });

  res.json({
    success: true,
    data: campaigns,
    total: campaigns.length,
    region: 'La Libertad, Perú',
    prizesAwardedTo: 'Top 3 Puestos (Oro, Plata, Bronce)',
  });
});

// GET /api/campaigns/:id
apiRouter.get('/campaigns/:id', (req: Request, res: Response) => {
  const campaign = catalogRepository.getCampaignById(req.params.id);
  if (!campaign) {
    res.status(404).json({ success: false, error: 'Campaña no encontrada' });
    return;
  }
  res.json({ success: true, data: campaign });
});

// POST /api/campaigns
apiRouter.post('/campaigns', (req: Request, res: Response) => {
  const { title, businessName, placeId, localityId, startDate, endDate, description, videoBrief, requirements, hashtags, prizes } = req.body;

  if (!title || !businessName || !startDate || !endDate) {
    res.status(400).json({ success: false, error: 'Título, nombre del local y fechas son requeridos' });
    return;
  }

  const defaultPrizes = prizes || {
    first: {
      position: 1,
      title: '1º Puesto — Oro',
      badge: '🥇 Ganador Absoluto',
      cashPEN: 1500,
      perks: ['S/ 1,500 en efectivo directo', 'Trofeo Oficial de Oro LibertadGO', 'Difusión destacada'],
    },
    second: {
      position: 2,
      title: '2º Puesto — Plata',
      badge: '🥈 Segundo Lugar',
      cashPEN: 800,
      perks: ['S/ 800 en efectivo', 'Experiencia gastronómica para 2 en el local', 'Certificado oficial'],
    },
    third: {
      position: 3,
      title: '3º Puesto — Bronce',
      badge: '🥉 Tercer Lugar',
      cashPEN: 400,
      perks: ['S/ 400 en efectivo', 'Canasta con productos regionales de La Libertad'],
    },
  };

  const newCampaign = catalogRepository.createCampaign({
    title,
    businessName,
    placeId: placeId || 'place_custom',
    localityId: localityId || 'trujillo',
    startDate,
    endDate,
    description: description || 'Campaña de video para creadores de contenido.',
    videoBrief: videoBrief || 'Video vertical de 30 a 60 segundos sobre la experiencia en nuestro local.',
    requirements: Array.isArray(requirements) ? requirements : ['Video vertical 9:16', 'Mención del local y #LibertadGO'],
    hashtags: Array.isArray(hashtags) ? hashtags : ['#LibertadGO', '#TurismoLaLibertad'],
    prizes: defaultPrizes,
    status: 'active',
  });

  res.status(201).json({ success: true, data: newCampaign });
});

// POST /api/campaigns/:id/submissions
apiRouter.post('/campaigns/:id/submissions', (req: Request, res: Response) => {
  const { creatorName, creatorHandle, platform, videoUrl, title, caption, thumbnailUrl } = req.body;

  if (!creatorName || !videoUrl || !title) {
    res.status(400).json({ success: false, error: 'Nombre del creador, enlace del video y título son obligatorios' });
    return;
  }

  const result = catalogRepository.addSubmission(req.params.id, {
    creatorName,
    creatorHandle: creatorHandle || '@creador',
    platform: platform || 'tiktok',
    videoUrl,
    title,
    caption: caption || '',
    thumbnailUrl: thumbnailUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
  });

  if (result.error || !result.submission) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }

  res.status(201).json({ success: true, data: result.submission });
});

// POST /api/campaigns/:id/submissions/:subId/vote
apiRouter.post('/campaigns/:id/submissions/:subId/vote', (req: Request, res: Response) => {
  const result = catalogRepository.voteSubmission(req.params.id, req.params.subId);
  if (!result.success) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }
  res.json({ success: true, newVotes: result.newVotes });
});

// =========================================================================
// ASISTENTE DE IA LIBERTADGO — 10 MENSAJES GRATIS CON GEMINI 3.8 FLASH
// =========================================================================

// POST /api/ai/chat
apiRouter.post('/ai/chat', async (req: Request, res: Response) => {
  try {
    const { message, context, remainingCredits } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ success: false, error: 'Mensaje requerido' });
      return;
    }

    // Dynamic import to avoid cold start issues
    const { generateAiResponse } = await import('./geminiService.ts');
    const result = await generateAiResponse({
      prompt: message,
      context,
    });

    const creditsLeft = typeof remainingCredits === 'number' ? Math.max(0, remainingCredits - 1) : 9;

    res.json({
      success: true,
      reply: result.reply,
      modelUsed: result.modelUsed,
      source: result.source,
      creditsRemaining: creditsLeft,
      freeCreditsCap: 10,
    });
  } catch (error) {
    console.error('[API /api/ai/chat Error]', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar consulta con el asistente de IA.',
    });
  }
});

