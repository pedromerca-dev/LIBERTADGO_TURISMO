/**
 * FASE 4 — Pruebas Automatizadas de Auditoría Integral de Seguridad,
 * Calidad, Concurrencia y Preparación para Producción.
 * 
 * Módulo: Videos y Creadores (LibertadGO / Wayra)
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Server } from 'node:http';
import { creatorsRouter } from './creatorsRoutes.ts';
import { adminRouter } from './adminRoutes.ts';
import { authRouter } from './authRoutes.ts';
import { authMiddleware, createToken, hashPassword } from './authService.ts';
import { getAuthRepository, getCreatorsRepository, resetRepositoriesForTesting } from './repositories/index.ts';
import { safeUrlSchema, AdminUpdateVideoPlacesSchema } from './creatorsSchemas.ts';
import { videoViewDeduplicator, authRateLimiter } from './rateLimiter.ts';

describe('FASE 4 — Auditoría Integral de Seguridad y Calidad (Videos y Creadores)', () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  before(async () => {
    app = express();
    app.use(express.json({ limit: '200kb' }));
    app.use(authMiddleware);
    app.use('/api/auth', authRouter);
    app.use('/api/creators', creatorsRouter);
    app.use('/api/admin', adminRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(async () => {
    resetRepositoriesForTesting();
    videoViewDeduplicator.clearForTesting();
    authRateLimiter.clearForTesting();
  });

  // =========================================================================
  // 1. SEGURIDAD, AUTENTICACIÓN Y AUTORIZACIÓN (IDOR & Control de Acceso)
  // =========================================================================
  describe('1. Seguridad, Autenticación y Autorización (IDOR)', () => {
    test('1.1. Endpoints privados retornan 401 si no hay token de autenticación', async () => {
      const endpoints = [
        { method: 'POST', path: '/api/creators/submissions', body: {} },
        { method: 'GET', path: '/api/creators/my-submissions' },
        { method: 'PUT', path: '/api/creators/profile/me', body: {} },
        { method: 'POST', path: '/api/creators/videos/vid_123/save' },
        { method: 'GET', path: '/api/creators/saved-videos' },
      ];

      for (const ep of endpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: ep.body ? { 'Content-Type': 'application/json' } : {},
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });
        assert.equal(res.status, 401, `Endpoint ${ep.path} debió responder 401`);
      }
    });

    test('1.2. Endpoints administrativos retornan 403 con usuario rol USER (RBAC)', async () => {
      const authRepo = getAuthRepository();
      const regularUser = await authRepo.createUser({
        email: 'turista.trujillo@libertadgo.pe',
        passwordHash: hashPassword('Pass12345!'),
        name: 'Turista Común',
        role: 'USER',
      });
      const token = createToken(regularUser);

      const adminEndpoints = [
        { method: 'GET', path: '/api/admin/metrics' },
        { method: 'GET', path: '/api/admin/moderation/queue' },
        { method: 'POST', path: '/api/admin/moderation/vid_123/action', body: { action: 'APPROVE' } },
        { method: 'PUT', path: '/api/admin/moderation/vid_123/places', body: { placeIds: ['place_chan_chan'] } },
      ];

      for (const ep of adminEndpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });
        assert.equal(res.status, 403, `Endpoint admin ${ep.path} debió responder 403 a rol USER`);
      }
    });

    test('1.3. IDOR: Ningún usuario puede usurpar la autoría ni el perfil de otro usuario', async () => {
      const authRepo = getAuthRepository();
      const userA = await authRepo.createUser({
        email: 'creadorA@libertadgo.pe',
        passwordHash: hashPassword('PassA12345!'),
        name: 'Creador Alpha',
        role: 'USER',
      });
      const userB = await authRepo.createUser({
        email: 'creadorB@libertadgo.pe',
        passwordHash: hashPassword('PassB12345!'),
        name: 'Creador Beta',
        role: 'USER',
      });

      const tokenA = createToken(userA);
      const tokenB = createToken(userB);

      // User A registra su perfil con handle @alpha_viajes
      const resProfileA = await fetch(`${baseUrl}/api/creators/profile/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          handle: 'alpha_viajes',
          displayName: 'Alpha Viajes',
          primaryPlatform: 'tiktok',
        }),
      });
      assert.equal(resProfileA.status, 200);

      // User B intenta usurpar el @handle de User A -> Conflicto 409
      const resProfileBConflict = await fetch(`${baseUrl}/api/creators/profile/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenB}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          handle: 'alpha_viajes',
          displayName: 'Beta Intruso',
          primaryPlatform: 'tiktok',
        }),
      });
      assert.equal(resProfileBConflict.status, 409);

      // User B envía un video. El backend fija req.user.userId = userB.id independientemente del payload
      const resSubmit = await fetch(`${baseUrl}/api/creators/submissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenB}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl: 'https://www.tiktok.com/@beta/video/7382910485918204918',
          title: 'Aventura en Huanchaco',
          contentType: 'PLACE',
          category: 'playas',
          localityId: 'huanchaco',
          placeIds: ['place_muelle_huanchaco'],
          primaryPlaceId: 'place_muelle_huanchaco',
        }),
      });
      assert.equal(resSubmit.status, 201);
      const submitData = await resSubmit.json();
      assert.equal(submitData.data.userId, userB.id, 'La autoría debe coincidir estrictamente con el token autenticado');
    });

    test('1.4. Redacción de seguridad: Notas internas y admin IDs no se exponen al público', async () => {
      const authRepo = getAuthRepository();
      const creatorsRepo = getCreatorsRepository();

      const admin = await authRepo.createUser({
        email: 'moderador.secreto@libertadgo.pe',
        passwordHash: hashPassword('MasterSecret2026!'),
        name: 'Super Auditor',
        role: 'ADMIN',
      });

      const video = await creatorsRepo.createSubmission({
        userId: 'external_user',
        platform: 'tiktok',
        externalVideoId: '7999888777666555444',
        videoUrl: 'https://www.tiktok.com/@viajero/video/7999888777666555444',
        embedUrl: 'https://www.tiktok.com/embed/v2/7999888777666555444',
        title: 'Trujillo Secreto y Colonial',
        contentType: 'PLACE',
        category: 'cultura',
        localityId: 'trujillo',
        status: 'APPROVED',
      });

      // Se registran notas internas confidenciales de moderación
      await creatorsRepo.updateSubmissionStatus(
        video.id,
        'APPROVED',
        'Aprobado bajo revisión manual estricta. Verificado por el auditor.',
        admin.id,
        {
          adminUserId: admin.id,
          adminName: admin.name,
          action: 'APPROVE',
          previousStatus: 'PENDING',
          newStatus: 'APPROVED',
          reason: 'Aprobación de auditoría',
          internalNotes: 'Nota altamente confidencial: ID de auditor ' + admin.id,
        }
      );

      // Consulta pública anónima de detalle
      const resDetail = await fetch(`${baseUrl}/api/creators/videos/${video.id}`);
      assert.equal(resDetail.status, 200);
      const detailJson = await resDetail.json();
      assert.equal(detailJson.data.moderationNotes, undefined, 'moderationNotes no debe existir en JSON público');
      assert.equal(detailJson.data.moderatedBy, undefined, 'moderatedBy no debe existir en JSON público');
      assert.equal(detailJson.data.moderatedAt, undefined, 'moderatedAt no debe existir en JSON público');

      // Consulta pública de feed
      const resFeed = await fetch(`${baseUrl}/api/creators/videos`);
      assert.equal(resFeed.status, 200);
      const feedJson = await resFeed.json();
      const foundInFeed = feedJson.data.find((v: any) => v.id === video.id);
      if (foundInFeed) {
        assert.equal(foundInFeed.moderationNotes, undefined);
        assert.equal(foundInFeed.moderatedBy, undefined);
      }
    });
  });

  // =========================================================================
  // 2. RATE LIMITING Y ANTI-ABUSO (Protección contra fuerza bruta y spam)
  // =========================================================================
  describe('2. Rate Limiting y Anti-Abuso', () => {
    test('2.1. Intentos repetidos de autenticación activan HTTP 429 Too Many Requests', async () => {
      // Configuramos intentos rápidos para agotar el límite
      let received429 = false;
      for (let i = 0; i < 25; i++) {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'bruteforce@libertadgo.pe',
            password: 'clave_incorrecta',
          }),
        });

        if (res.status === 429) {
          received429 = true;
          const json = await res.json();
          assert.ok(
            json.error.includes('Demasiados intentos') || json.error.includes('Demasiadas solicitudes'),
            `Mensaje de error inesperado: ${json.error}`
          );
          break;
        }
      }
      assert.ok(received429, 'Debió activarse el rate limiter con código HTTP 429');
    });

    test('2.2. Deduplicación de visualizaciones: No infla contador ante visitas repetidas inmediatas', async () => {
      const creatorsRepo = getCreatorsRepository();
      const video = await creatorsRepo.createSubmission({
        userId: 'creator_view_test',
        platform: 'youtube',
        externalVideoId: 'dQw4w9WgXcQ',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        title: 'Video para prueba de vistas',
        contentType: 'GENERAL',
        category: 'musica',
        status: 'APPROVED',
      });

      assert.equal(video.internalViewsCount, 0);

      // Primera visita: incrementa a 1
      const res1 = await fetch(`${baseUrl}/api/creators/videos/${video.id}`);
      assert.equal(res1.status, 200);
      const json1 = await res1.json();
      assert.equal(json1.data.internalViewsCount, 1);

      // Segunda visita inmediata desde la misma IP: cooldown activo, permanece en 1
      const res2 = await fetch(`${baseUrl}/api/creators/videos/${video.id}`);
      assert.equal(res2.status, 200);
      const json2 = await res2.json();
      assert.equal(json2.data.internalViewsCount, 1, 'No debe inflar vistas durante ventana de cooldown');

      // Tercera visita inmediata: permanece en 1
      const res3 = await fetch(`${baseUrl}/api/creators/videos/${video.id}`);
      assert.equal(res3.status, 200);
      const json3 = await res3.json();
      assert.equal(json3.data.internalViewsCount, 1);
    });
  });

  // =========================================================================
  // 3. CICLO DE VIDA Y PREVENCIÓN DE DUPLICADOS
  // =========================================================================
  describe('3. Ciclo de Vida y Transiciones de Estado', () => {
    test('3.1. Videos en estado PENDING, REJECTED y HIDDEN están aislados del catálogo público', async () => {
      const creatorsRepo = getCreatorsRepository();

      const pendingVid = await creatorsRepo.createSubmission({
        userId: 'u1',
        platform: 'tiktok',
        externalVideoId: '1111111111',
        videoUrl: 'https://www.tiktok.com/@u/video/1111111111',
        embedUrl: 'https://www.tiktok.com/embed/v2/1111111111',
        title: 'Video Pendiente',
        contentType: 'GENERAL',
        category: 'cultura',
        status: 'PENDING',
      });

      const rejectedVid = await creatorsRepo.createSubmission({
        userId: 'u2',
        platform: 'tiktok',
        externalVideoId: '2222222222',
        videoUrl: 'https://www.tiktok.com/@u/video/2222222222',
        embedUrl: 'https://www.tiktok.com/embed/v2/2222222222',
        title: 'Video Rechazado',
        contentType: 'GENERAL',
        category: 'cultura',
        status: 'REJECTED',
      });

      const hiddenVid = await creatorsRepo.createSubmission({
        userId: 'u3',
        platform: 'tiktok',
        externalVideoId: '3333333333',
        videoUrl: 'https://www.tiktok.com/@u/video/3333333333',
        embedUrl: 'https://www.tiktok.com/embed/v2/3333333333',
        title: 'Video Oculto',
        contentType: 'GENERAL',
        category: 'cultura',
        status: 'HIDDEN',
      });

      const res = await fetch(`${baseUrl}/api/creators/videos`);
      assert.equal(res.status, 200);
      const json = await res.json();
      const ids = json.data.map((v: any) => v.id);

      assert.ok(!ids.includes(pendingVid.id), 'Video PENDING no debe figurar en feed público');
      assert.ok(!ids.includes(rejectedVid.id), 'Video REJECTED no debe figurar en feed público');
      assert.ok(!ids.includes(hiddenVid.id), 'Video HIDDEN no debe figurar en feed público');

      // Consulta directa por ID devuelve 404 a clientes anónimos
      const resPendingDetail = await fetch(`${baseUrl}/api/creators/videos/${pendingVid.id}`);
      assert.equal(resPendingDetail.status, 404);
    });

    test('3.2. Envío duplicado de video idéntico en plataforma retorna HTTP 409 Conflict', async () => {
      const authRepo = getAuthRepository();
      const user = await authRepo.createUser({
        email: 'creador.duplicados@libertadgo.pe',
        passwordHash: hashPassword('Pass12345!'),
        name: 'Creador Duplicado',
        role: 'USER',
      });
      const token = createToken(user);

      const payload = {
        videoUrl: 'https://www.tiktok.com/@viajes/video/7483920194827361948',
        title: 'Visita a Chan Chan',
        contentType: 'PLACE',
        category: 'arqueologia',
        localityId: 'trujillo',
        placeIds: ['place_chan_chan'],
        primaryPlaceId: 'place_chan_chan',
      };

      const res1 = await fetch(`${baseUrl}/api/creators/submissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      assert.equal(res1.status, 201);

      // Reintento idéntico mientras está en PENDING
      const res2 = await fetch(`${baseUrl}/api/creators/submissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      assert.equal(res2.status, 409);
      const json2 = await res2.json();
      assert.ok(json2.error.includes('en revisión'));
    });
  });

  // =========================================================================
  // 4. FAVORITOS, CONCURRENCIA Y CONSULTA DE VIDEOS GUARDADOS
  // =========================================================================
  describe('4. Favoritos, Concurrencia y Sincronización', () => {
    test('4.1. Guardar y desguardar video (toggle) y consulta mediante GET /saved-videos', async () => {
      const authRepo = getAuthRepository();
      const creatorsRepo = getCreatorsRepository();

      const user = await authRepo.createUser({
        email: 'favoritos.tester@libertadgo.pe',
        passwordHash: hashPassword('Pass12345!'),
        name: 'Tester Favoritos',
        role: 'USER',
      });
      const token = createToken(user);

      const video = await creatorsRepo.createSubmission({
        userId: 'otro_creador',
        platform: 'tiktok',
        externalVideoId: '888777666555444333',
        videoUrl: 'https://www.tiktok.com/@viajero/video/888777666555444333',
        embedUrl: 'https://www.tiktok.com/embed/v2/888777666555444333',
        title: 'Gastronomía Trujillana: El Shámbar',
        contentType: 'PLACE',
        category: 'gastronomia',
        localityId: 'trujillo',
        status: 'APPROVED',
      });

      // 1. Guardar video en favoritos
      const saveRes1 = await fetch(`${baseUrl}/api/creators/videos/${video.id}/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(saveRes1.status, 200);
      const saveJson1 = await saveRes1.json();
      assert.equal(saveJson1.saved, true);

      // 2. Consultar videos guardados del usuario
      const listSavedRes = await fetch(`${baseUrl}/api/creators/saved-videos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(listSavedRes.status, 200);
      const listSavedJson = await listSavedRes.json();
      assert.equal(listSavedJson.total, 1);
      assert.equal(listSavedJson.data[0].id, video.id);

      // 3. Quitar de favoritos (toggle inverso)
      const saveRes2 = await fetch(`${baseUrl}/api/creators/videos/${video.id}/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(saveRes2.status, 200);
      const saveJson2 = await saveRes2.json();
      assert.equal(saveJson2.saved, false);

      // 4. Lista ahora vacía
      const listSavedRes2 = await fetch(`${baseUrl}/api/creators/saved-videos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const listSavedJson2 = await listSavedRes2.json();
      assert.equal(listSavedJson2.total, 0);
    });

    test('4.2. Intentar guardar un video no aprobado o inexistente retorna HTTP 404', async () => {
      const authRepo = getAuthRepository();
      const creatorsRepo = getCreatorsRepository();

      const user = await authRepo.createUser({
        email: 'guardar.error@libertadgo.pe',
        passwordHash: hashPassword('Pass12345!'),
        name: 'Tester Guardar Error',
        role: 'USER',
      });
      const token = createToken(user);

      // Video en estado PENDING
      const pendingVideo = await creatorsRepo.createSubmission({
        userId: 'alguien',
        platform: 'tiktok',
        externalVideoId: '777111222333',
        videoUrl: 'https://www.tiktok.com/@alguien/video/777111222333',
        embedUrl: 'https://www.tiktok.com/embed/v2/777111222333',
        title: 'Video No Aprobado',
        contentType: 'GENERAL',
        category: 'cultura',
        status: 'PENDING',
      });

      const resPending = await fetch(`${baseUrl}/api/creators/videos/${pendingVideo.id}/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(resPending.status, 404);

      // Video completamente inexistente
      const resInexistent = await fetch(`${baseUrl}/api/creators/videos/vid_inexistente_999/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(resInexistent.status, 404);
    });

    test('4.3. Concurrencia: Múltiples toggles simultáneos mantienen sincronía exacta sin contadores negativos', async () => {
      const creatorsRepo = getCreatorsRepository();
      const video = await creatorsRepo.createSubmission({
        userId: 'creator_concurrency',
        platform: 'youtube',
        externalVideoId: 'concurrencyVid',
        videoUrl: 'https://www.youtube.com/watch?v=concurrencyVid',
        embedUrl: 'https://www.youtube.com/embed/concurrencyVid',
        title: 'Video Prueba Concurrencia',
        contentType: 'GENERAL',
        category: 'naturaleza',
        status: 'APPROVED',
      });

      // Ejecutamos 6 operaciones simultáneas de guardado alternado
      const users = ['user_c1', 'user_c2', 'user_c3'];
      await Promise.all(users.map((u) => creatorsRepo.toggleSaveVideo(u, video.id)));

      // Verificamos que el contador interno es exactamente 3
      const check1 = await creatorsRepo.findSubmissionById(video.id);
      assert.equal(check1?.internalSavesCount, 3);

      // Ahora 2 de los 3 usuarios desguardan simultáneamente
      await Promise.all([
        creatorsRepo.toggleSaveVideo('user_c1', video.id),
        creatorsRepo.toggleSaveVideo('user_c2', video.id),
      ]);

      const check2 = await creatorsRepo.findSubmissionById(video.id);
      assert.equal(check2?.internalSavesCount, 1);

      // El último usuario desguarda: contador queda exactamente en 0
      await creatorsRepo.toggleSaveVideo('user_c3', video.id);
      const check3 = await creatorsRepo.findSubmissionById(video.id);
      assert.equal(check3?.internalSavesCount, 0);
      assert.ok((check3?.internalSavesCount || 0) >= 0, 'El contador jamás puede ser negativo');
    });
  });

  // =========================================================================
  // 5. VALIDACIÓN DE ENTRADAS, RENDIMIENTO Y PAGINACIÓN
  // =========================================================================
  describe('5. Rendimiento, Paginación y Validación de Esquemas', () => {
    test('5.1. Paginación segura: Parámetros inválidos se acotan limpiamente (safePage y safeLimit)', async () => {
      const res = await fetch(`${baseUrl}/api/creators/videos?page=-5&limit=99999`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.page, 1, 'page negativo debió acotarse a 1');
      assert.equal(json.limit, 100, 'limit excesivo debió acotarse a 100');
      assert.ok(json.totalPages >= 1);
    });

    test('5.2. AdminUpdateVideoPlacesSchema restringe a máximo 10 lugares y valida estructura', () => {
      // 11 lugares -> debe fallar por exceder max(10)
      const elevenPlaces = Array.from({ length: 11 }, (_, i) => `place_${i}`);
      const invalidResult = AdminUpdateVideoPlacesSchema.safeParse({
        placeIds: elevenPlaces,
      });
      assert.equal(invalidResult.success, false);

      // 3 lugares válidos
      const validResult = AdminUpdateVideoPlacesSchema.safeParse({
        placeIds: ['place_chan_chan', 'place_huanchaco_playa'],
        primaryPlaceId: 'place_chan_chan',
      });
      assert.equal(validResult.success, true);
    });

    test('5.3. safeUrlSchema restringe protocolos peligrosos (javascript:, data:, file:) permitiendo únicamente http/https', () => {
      const dangerousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'ftp://anonymous:secret@ftp.example.com',
        'http://',
        '',
      ];

      for (const badUrl of dangerousUrls) {
        const result = safeUrlSchema.safeParse(badUrl);
        assert.equal(result.success, false, `URL peligrosa debió ser rechazada: ${badUrl}`);
      }

      const safeUrls = [
        'https://www.tiktok.com/@viajero/video/1234567890',
        'https://images.unsplash.com/photo-123456789',
        'http://example.com/tour.jpg',
      ];

      for (const goodUrl of safeUrls) {
        const result = safeUrlSchema.safeParse(goodUrl);
        assert.equal(result.success, true, `URL válida debió ser aceptada: ${goodUrl}`);
      }
    });
  });
});
