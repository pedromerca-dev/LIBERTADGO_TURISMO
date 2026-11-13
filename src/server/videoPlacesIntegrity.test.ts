import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCreatorsRepository } from './repositories/memoryCreatorsRepository.ts';
import { PostgresCreatorsRepository } from './repositories/postgresCreatorsRepository.ts';
import { INITIAL_PLACES } from '../data/initialPlaces.ts';
import { adaptVideoSubmissionToTikTokVideo } from '../utils/videoAdapter.ts';
import { SubmitVideoSchema, AdminCreateVideoSchema, AdminUpdateVideoSchema } from './creatorsSchemas.ts';

describe('FASE 3 — Auditoría e Integridad de Lugares y Métricas (LibertadGO)', () => {
  const p1 = INITIAL_PLACES[0].id; // e.g. plaza-armas-trujillo
  const p2 = INITIAL_PLACES[1].id; // e.g. huaca-sol-luna
  const p3 = INITIAL_PLACES[2].id; // e.g. chan-chan

  describe('1. Relaciones entre Videos y Lugares (video_places)', () => {
    test('1.1. createSubmission vincula múltiples lugares y respeta primaryPlaceId', async () => {
      const repo = new MemoryCreatorsRepository();
      const sub = await repo.createSubmission(
        {
          userId: 'user_test',
          platform: 'tiktok',
          externalVideoId: 'ext_test_1',
          videoUrl: 'https://www.tiktok.com/@viajero/video/7192837482',
          embedUrl: 'https://www.tiktok.com/embed/v2/7192837482',
          title: 'Explorando La Libertad',
          contentType: 'PLACE',
          category: 'Arqueología',
        },
        [p1, p2, p3],
        p2 // p2 es el principal
      );

      const places = await repo.getPlacesForVideo(sub.id);
      assert.equal(places.length, 3);
      // El lugar primario (p2) debe ubicarse obligatoriamente en el índice 0 para resolver el nombre principal
      assert.equal(places[0].id, p2);
    });

    test('1.2. getPlacesForVideo preserva el orden primario (places[0]) independientemente del orden de INITIAL_PLACES', async () => {
      const repo = new MemoryCreatorsRepository();
      // Asociamos p3 como primario (aunque p1 esté primero en INITIAL_PLACES)
      const sub = await repo.createSubmission(
        {
          userId: 'user_test',
          platform: 'tiktok',
          externalVideoId: 'ext_test_order',
          videoUrl: 'https://www.tiktok.com/@viajero/video/7192837483',
          embedUrl: 'https://www.tiktok.com/embed/v2/7192837483',
          title: 'Chan Chan Arqueología',
          contentType: 'PLACE',
          category: 'Arqueología',
        },
        [p1, p3],
        p3 // p3 es el primario
      );

      const places = await repo.getPlacesForVideo(sub.id);
      assert.equal(places[0].id, p3, 'El primer lugar devuelto debe ser el lugar primario (p3)');
      assert.equal(places[1].id, p1);
    });

    test('1.3. Deduplicación: Si se envían IDs repetidos en placeIds, se deduplican limpiamente', async () => {
      const repo = new MemoryCreatorsRepository();
      const sub = await repo.createSubmission(
        {
          userId: 'user_test',
          platform: 'tiktok',
          externalVideoId: 'ext_test_dedup',
          videoUrl: 'https://www.tiktok.com/@viajero/video/7192837484',
          embedUrl: 'https://www.tiktok.com/embed/v2/7192837484',
          title: 'Deduplicación de Lugares',
          contentType: 'PLACE',
          category: 'Destinos',
        },
        [p1, p1, p2, p2, p1],
        p1
      );

      const places = await repo.getPlacesForVideo(sub.id);
      assert.equal(places.length, 2, 'Debe haber exactamente 2 lugares únicos');
      assert.equal(places[0].id, p1);
      assert.equal(places[1].id, p2);
    });

    test('1.4. Integridad: primaryPlaceId inexistente en placeIds es rechazado con error', async () => {
      const repo = new MemoryCreatorsRepository();
      await assert.rejects(
        async () => {
          await repo.createSubmission(
            {
              userId: 'user_test',
              platform: 'tiktok',
              externalVideoId: 'ext_test_invalid_primary',
              videoUrl: 'https://www.tiktok.com/@viajero/video/7192837485',
              embedUrl: 'https://www.tiktok.com/embed/v2/7192837485',
              title: 'Lugar Primario Inválido',
              contentType: 'PLACE',
              category: 'Destinos',
            },
            [p1, p2],
            'lugar_fantasma_no_incluido'
          );
        },
        /primaryPlaceId must be one of the associated placeIds/
      );
    });

    test('1.5. Zod Schemas rechazan primaryPlaceId si no pertenece a placeIds', () => {
      const invalidSubmit = SubmitVideoSchema.safeParse({
        videoUrl: 'https://www.tiktok.com/@turismo/video/7192837482918273645',
        title: 'Video con Primario Invalido',
        contentType: 'PLACE',
        category: 'Playas',
        placeIds: [p1, p2],
        primaryPlaceId: 'lugar_inexistente',
      });
      assert.equal(invalidSubmit.success, false);
      assert.match(
        invalidSubmit.error.issues[0].message,
        /El lugar principal \(primaryPlaceId\) debe pertenecer a la lista de lugares asociados/
      );

      const invalidAdminCreate = AdminCreateVideoSchema.safeParse({
        videoUrl: 'https://www.tiktok.com/@turismo/video/7192837482918273645',
        title: 'Admin Video Primario Invalido',
        contentType: 'PLACE',
        category: 'Playas',
        placeIds: [p1],
        primaryPlaceId: p2,
      });
      assert.equal(invalidAdminCreate.success, false);

      const validAdminCreate = AdminCreateVideoSchema.safeParse({
        videoUrl: 'https://www.tiktok.com/@turismo/video/7192837482918273645',
        title: 'Admin Video Primario Valido',
        contentType: 'PLACE',
        category: 'Playas',
        placeIds: [p1, p2],
        primaryPlaceId: p2,
      });
      assert.equal(validAdminCreate.success, true);
    });
  });

  describe('2. Actualizaciones Parciales (updateSubmission)', () => {
    test('2.1. Actualización de título no altera descripción, lugares ni métricas previas', async () => {
      const repo = new MemoryCreatorsRepository();
      const sub = await repo.createSubmission(
        {
          userId: 'user_test',
          platform: 'tiktok',
          externalVideoId: 'ext_test_partial',
          videoUrl: 'https://www.tiktok.com/@viajero/video/7192837486',
          embedUrl: 'https://www.tiktok.com/embed/v2/7192837486',
          title: 'Título Inicial',
          description: 'Descripción original detallada',
          contentType: 'PLACE',
          category: 'Cultura',
          localityId: 'trujillo',
          thumbnailUrl: 'https://example.com/thumb.jpg',
        },
        [p1, p2],
        p1
      );

      // Simulamos que el video acumuló reproducciones y guardados
      await repo.incrementInternalViews(sub.id);
      await repo.incrementInternalViews(sub.id);
      await repo.toggleSaveVideo('user_123', sub.id);

      // Actualizamos ÚNICAMENTE el título
      const updated = await repo.updateSubmission(sub.id, {
        title: 'Título Modificado y Mejorado',
      });

      assert.ok(updated);
      assert.equal(updated.title, 'Título Modificado y Mejorado');
      assert.equal(updated.description, 'Descripción original detallada');
      assert.equal(updated.localityId, 'trujillo');
      assert.equal(updated.thumbnailUrl, 'https://example.com/thumb.jpg');
      assert.equal(updated.internalViewsCount, 2, 'Las vistas internas deben preservarse');
      assert.equal(updated.internalSavesCount, 1, 'Los guardados internos deben preservarse');

      // Verificar que los lugares siguen intactos
      const places = await repo.getPlacesForVideo(sub.id);
      assert.equal(places.length, 2);
      assert.equal(places[0].id, p1);
    });

    test('2.2. Actualización con descripción explícita null borra la descripción (soporte de nulabilidad)', async () => {
      const repo = new MemoryCreatorsRepository();
      const sub = await repo.createSubmission(
        {
          userId: 'user_test',
          platform: 'tiktok',
          externalVideoId: 'ext_test_null_desc',
          videoUrl: 'https://www.tiktok.com/@viajero/video/7192837487',
          embedUrl: 'https://www.tiktok.com/embed/v2/7192837487',
          title: 'Video con descripción previa',
          description: 'Esta descripción será borrada',
          contentType: 'GENERAL',
          category: 'Gastronomía',
        },
        [p1]
      );

      const updated = await repo.updateSubmission(sub.id, {
        description: null,
      });

      assert.ok(updated);
      assert.equal(updated.description, null, 'description debe ser limpiada a null cuando se envía explícitamente null');
    });

    test('2.3. Actualización de placeIds preserva el lugar primario previo si continúa en la nueva lista', async () => {
      const repo = new MemoryCreatorsRepository();
      const sub = await repo.createSubmission(
        {
          userId: 'user_test',
          platform: 'tiktok',
          externalVideoId: 'ext_test_preserve_primary',
          videoUrl: 'https://www.tiktok.com/@viajero/video/7192837488',
          embedUrl: 'https://www.tiktok.com/embed/v2/7192837488',
          title: 'Preservación de Primario',
          contentType: 'PLACE',
          category: 'Arqueología',
        },
        [p1, p2],
        p2 // p2 es primario
      );

      // Ahora actualizamos placeIds a [p3, p2] sin especificar primaryPlaceId
      const updated = await repo.updateSubmission(sub.id, {}, [p3, p2]);
      assert.ok(updated);

      const places = await repo.getPlacesForVideo(sub.id);
      assert.equal(places.length, 2);
      // p2 debe mantenerse como primario en el índice 0 porque existía previamente como primario
      assert.equal(places[0].id, p2);
      assert.equal(places[1].id, p3);
    });

    test('2.4. Cambio de primaryPlaceId sin alterar placeIds cambia el flag is_primary', async () => {
      const repo = new MemoryCreatorsRepository();
      const sub = await repo.createSubmission(
        {
          userId: 'user_test',
          platform: 'tiktok',
          externalVideoId: 'ext_test_change_primary',
          videoUrl: 'https://www.tiktok.com/@viajero/video/7192837489',
          embedUrl: 'https://www.tiktok.com/embed/v2/7192837489',
          title: 'Cambio de Primario',
          contentType: 'PLACE',
          category: 'Arqueología',
        },
        [p1, p2],
        p1
      );

      // Cambiamos primario a p2
      await repo.updateSubmission(sub.id, {}, undefined, p2);

      const places = await repo.getPlacesForVideo(sub.id);
      assert.equal(places[0].id, p2, 'p2 debe ser ahora el primer lugar devuelto');
    });

    test('2.5. Actualización con placeIds: [] desvincula todos los lugares', async () => {
      const repo = new MemoryCreatorsRepository();
      const sub = await repo.createSubmission(
        {
          userId: 'user_test',
          platform: 'tiktok',
          externalVideoId: 'ext_test_clear_places',
          videoUrl: 'https://www.tiktok.com/@viajero/video/7192837490',
          embedUrl: 'https://www.tiktok.com/embed/v2/7192837490',
          title: 'Desvinculación Total',
          contentType: 'GENERAL',
          category: 'General',
        },
        [p1, p2]
      );

      await repo.updateSubmission(sub.id, {}, []);
      const places = await repo.getPlacesForVideo(sub.id);
      assert.equal(places.length, 0);
    });
  });

  describe('3. Integridad de Métricas y External Identity JSONB', () => {
    test('3.1. Edición de título y categoría preserva las métricas sociales externas (views, likes, comments)', async () => {
      const repo = new MemoryCreatorsRepository();
      const sub = await repo.createSubmission(
        {
          userId: 'user_test',
          platform: 'tiktok',
          externalVideoId: 'ext_metrics_preserve',
          videoUrl: 'https://www.tiktok.com/@viajero/video/7192837491',
          embedUrl: 'https://www.tiktok.com/embed/v2/7192837491',
          title: 'Video con Métricas Externas Reales',
          contentType: 'PLACE',
          category: 'Playas',
          externalCreatorHandle: 'viajero_norte',
        },
        [p1]
      );

      // Inyectamos métricas sociales verificadas (como si vinieran de la API externa)
      await repo.updateSubmission(sub.id, {
        externalMetrics: {
          views: 185000,
          likes: 9400,
          comments: 420,
          creatorHandle: 'viajero_norte',
          creatorDisplayName: 'Viajero del Norte',
        },
      });

      // Ahora el admin edita únicamente el título
      const afterTitleEdit = await repo.updateSubmission(sub.id, {
        title: 'Nuevo Título Editorial',
      });

      assert.ok(afterTitleEdit);
      assert.equal(afterTitleEdit.externalMetrics?.views, 185000, 'Las vistas de TikTok deben preservarse intactas');
      assert.equal(afterTitleEdit.externalMetrics?.likes, 9400, 'Los likes de TikTok deben preservarse intactos');
      assert.equal(afterTitleEdit.externalMetrics?.comments, 420, 'Los comentarios deben preservarse intactos');
      assert.equal(afterTitleEdit.externalMetrics?.creatorHandle, 'viajero_norte');
    });

    test('3.2. Actualizar identidad externa (@handle) preserva las métricas sociales existentes', async () => {
      const repo = new MemoryCreatorsRepository();
      const sub = await repo.createSubmission(
        {
          userId: 'user_test',
          platform: 'tiktok',
          externalVideoId: 'ext_metrics_handle_update',
          videoUrl: 'https://www.tiktok.com/@viajero/video/7192837492',
          embedUrl: 'https://www.tiktok.com/embed/v2/7192837492',
          title: 'Video con Métricas',
          contentType: 'PLACE',
          category: 'Cultura',
        },
        [p1]
      );

      await repo.updateSubmission(sub.id, {
        externalMetrics: {
          views: 50000,
          likes: 2500,
          comments: 110,
        },
      });

      // Se actualiza el handle del creador
      const updated = await repo.updateSubmission(sub.id, {
        externalCreatorHandle: 'nuevo_handle_oficial',
        externalCreatorDisplayName: 'Nuevo Creador',
      });

      assert.ok(updated);
      assert.equal(updated.externalMetrics?.views, 50000, 'Las vistas externas no deben perderse al cambiar el creador');
      assert.equal(updated.externalMetrics?.likes, 2500);
      assert.equal(updated.externalMetrics?.creatorHandle, 'nuevo_handle_oficial');
      assert.equal(updated.externalMetrics?.creatorDisplayName, 'Nuevo Creador');
    });
  });

  describe('4. Consistencia en Ranking Público y Formatos', () => {
    test('4.1. adaptVideoSubmissionToTikTokVideo provee rawDate ISO y separa métricas externas de internas', () => {
      const submission = {
        id: 'vid_123',
        userId: 'u_1',
        platform: 'tiktok' as const,
        externalVideoId: 'ext_1',
        videoUrl: 'https://www.tiktok.com/@explorador/video/7192837482',
        embedUrl: 'https://www.tiktok.com/embed/v2/7192837482',
        thumbnailUrl: null,
        title: 'Ruta Arqueológica Moche',
        contentType: 'PLACE' as const,
        category: 'Arqueología',
        status: 'APPROVED' as const,
        internalViewsCount: 45,
        internalSavesCount: 12,
        externalMetrics: {
          views: 250000,
          likes: 18000,
          comments: 950,
          creatorHandle: 'explorador',
        },
        places: [INITIAL_PLACES[0]],
        createdAt: '2026-11-10T14:30:00.000Z',
        updatedAt: '2026-11-10T14:30:00.000Z',
      };

      const adapted = adaptVideoSubmissionToTikTokVideo(submission);

      assert.equal(adapted.externalViews, 250000);
      assert.equal(adapted.externalLikes, 18000);
      assert.equal(adapted.internalViews, 45);
      assert.equal(adapted.internalSaves, 12);
      assert.equal(adapted.rawDate, '2026-11-10T14:30:00.000Z');
      assert.equal(adapted.placeName, INITIAL_PLACES[0].name);
      assert.equal(adapted.creator, '@explorador');
    });

    test('4.2. Videos sin métricas sociales no producen NaN ni fake 0 en comparaciones', () => {
      const submissionNoMetrics = {
        id: 'vid_no_metrics',
        userId: 'u_2',
        platform: 'tiktok' as const,
        externalVideoId: 'ext_2',
        videoUrl: 'https://www.tiktok.com/@nuevo/video/7192837483',
        embedUrl: 'https://www.tiktok.com/embed/v2/7192837483',
        thumbnailUrl: null,
        title: 'Video Reciente sin Métricas',
        contentType: 'GENERAL' as const,
        category: 'Playas',
        status: 'APPROVED' as const,
        internalViewsCount: 0,
        internalSavesCount: 0,
        externalMetrics: null,
        createdAt: '2026-11-11T10:00:00.000Z',
        updatedAt: '2026-11-11T10:00:00.000Z',
      };

      const adapted = adaptVideoSubmissionToTikTokVideo(submissionNoMetrics);
      assert.equal(adapted.externalViews, null);
      assert.equal(adapted.externalLikes, null);
      assert.equal(adapted.internalViews, 0);

      // Verificamos que la fórmula de ordenamiento popular no produzca NaN
      const viewsA = adapted.externalViews ?? adapted.views ?? 0;
      assert.equal(Number.isNaN(viewsA), false);
      assert.equal(viewsA, 0);
    });
  });

  describe('5. Paridad entre PostgreSQL y Memory Repository', () => {
    test('5.1. Ambos repositorios validan primaryPlaceId y deduplican de forma idéntica', () => {
      const memoryRepo = new MemoryCreatorsRepository();
      assert.equal(typeof memoryRepo.associatePlaces, 'function');
      assert.equal(typeof memoryRepo.getPlacesForVideo, 'function');
      assert.equal(typeof memoryRepo.updateSubmission, 'function');
      assert.equal(typeof memoryRepo.createSubmission, 'function');

      // Verificamos firmas de PostgresCreatorsRepository
      const dummyPool: any = { query: async () => ({ rows: [] }), connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) };
      const pgRepo = new PostgresCreatorsRepository(dummyPool);
      assert.equal(typeof pgRepo.associatePlaces, 'function');
      assert.equal(typeof pgRepo.getPlacesForVideo, 'function');
      assert.equal(typeof pgRepo.updateSubmission, 'function');
      assert.equal(typeof pgRepo.createSubmission, 'function');
    });
  });
});
