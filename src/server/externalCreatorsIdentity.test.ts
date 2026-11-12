import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCreatorsRepository } from './repositories/memoryCreatorsRepository.ts';
import { mapVideoSubmissionRow } from './repositories/postgresCreatorsRepository.ts';
import { resolveCreatorLabel, adaptVideoSubmissionToTikTokVideo } from '../utils/videoAdapter.ts';
import { AdminCreateVideoSchema, AdminUpdateVideoSchema } from './creatorsSchemas.ts';
import { VideoSubmission } from '../types/creators.ts';

describe('Auditoría e Identidad de Creadores Externos (Prioridad y Aislamiento)', () => {
  let memoryRepo: MemoryCreatorsRepository;

  beforeEach(() => {
    memoryRepo = new MemoryCreatorsRepository();
  });

  test('1. Video con perfil registrado tiene máxima prioridad sobre datos externos o administradores', () => {
    const videoWithProfile: VideoSubmission = {
      id: 'vid_reg_1',
      userId: 'usr_admin_1',
      userName: 'Super Administrador',
      creatorProfileId: 'cp_1',
      creatorHandle: 'arqueologia_viva',
      creatorDisplayName: 'Arqueología Viva Trujillo',
      externalCreatorHandle: 'tiktok_externo',
      externalCreatorDisplayName: 'TikTok Externo',
      videoUrl: 'https://www.tiktok.com/@tiktok_externo/video/1234567890123456789',
      embedUrl: 'https://www.tiktok.com/embed/v2/1234567890123456789',
      thumbnailUrl: null,
      title: 'Chan Chan al atardecer',
      platform: 'tiktok',
      externalVideoId: '1234567890123456789',
      contentType: 'PLACE',
      category: 'arqueologia',
      status: 'APPROVED',
      internalViewsCount: 10,
      internalSavesCount: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const label = resolveCreatorLabel(videoWithProfile);
    assert.equal(label, '@arqueologia_viva');

    const adapted = adaptVideoSubmissionToTikTokVideo(videoWithProfile);
    assert.equal(adapted.creator, '@arqueologia_viva');
    assert.notEqual(adapted.creator, 'Super Administrador');
  });

  test('2. Video externo sin perfil (creatorProfileId = NULL) conserva externalCreatorHandle con formato @handle', () => {
    const externalVideo: VideoSubmission = {
      id: 'vid_ext_1',
      userId: 'usr_admin_99',
      userName: 'Admin Gestor Regional',
      creatorProfileId: null,
      creatorHandle: null,
      creatorDisplayName: null,
      externalCreatorHandle: 'viajerotrujillano',
      externalCreatorDisplayName: 'Viajero Trujillano Oficial',
      videoUrl: 'https://www.tiktok.com/@viajerotrujillano/video/9876543210987654321',
      embedUrl: 'https://www.tiktok.com/embed/v2/9876543210987654321',
      thumbnailUrl: null,
      title: 'Los mejores caballitos de totora en Huanchaco',
      platform: 'tiktok',
      externalVideoId: '9876543210987654321',
      contentType: 'PLACE',
      category: 'playas',
      status: 'APPROVED',
      internalViewsCount: 50,
      internalSavesCount: 20,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const label = resolveCreatorLabel(externalVideo);
    assert.equal(label, '@viajerotrujillano');

    const adapted = adaptVideoSubmissionToTikTokVideo(externalVideo);
    assert.equal(adapted.creator, '@viajerotrujillano');
    assert.notEqual(adapted.creator, 'Admin Gestor Regional');
  });

  test('3. Video externo con externalCreatorDisplayName cuando no hay handle', () => {
    const videoWithDisplayName: VideoSubmission = {
      id: 'vid_ext_2',
      userId: 'usr_admin_master',
      userName: 'Director de Turismo La Libertad',
      creatorProfileId: null,
      creatorHandle: null,
      creatorDisplayName: null,
      externalCreatorHandle: null,
      externalCreatorDisplayName: 'Rutas Gastronómicas del Norte',
      videoUrl: 'https://www.instagram.com/reel/C2xyz123abc/',
      embedUrl: 'https://www.instagram.com/p/C2xyz123abc/embed',
      thumbnailUrl: null,
      title: 'Plaza Mayor de Trujillo de noche',
      platform: 'instagram',
      externalVideoId: 'C2xyz123abc',
      contentType: 'PLACE',
      category: 'cultura',
      status: 'APPROVED',
      internalViewsCount: 15,
      internalSavesCount: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const label = resolveCreatorLabel(videoWithDisplayName);
    assert.equal(label, 'Rutas Gastronómicas del Norte');

    const adapted = adaptVideoSubmissionToTikTokVideo(videoWithDisplayName);
    assert.equal(adapted.creator, 'Rutas Gastronómicas del Norte');
    assert.notEqual(adapted.creator, 'Director de Turismo La Libertad');
  });

  test('4. Creador neutral: NUNCA se utiliza el nombre del administrador (userName) como creador', () => {
    const videoWithoutIdentity: VideoSubmission = {
      id: 'vid_neutral_1',
      userId: 'usr_admin_master',
      userName: 'Administrador Principal de la Plataforma',
      creatorProfileId: null,
      creatorHandle: null,
      creatorDisplayName: null,
      externalCreatorHandle: null,
      externalCreatorDisplayName: null,
      externalMetrics: null,
      videoUrl: 'https://www.instagram.com/p/D3abc987xyz/',
      embedUrl: 'https://www.instagram.com/p/D3abc987xyz/embed',
      thumbnailUrl: null,
      title: 'Paseo por Moche',
      platform: 'instagram',
      externalVideoId: 'D3abc987xyz',
      contentType: 'PLACE',
      category: 'cultura',
      status: 'APPROVED',
      internalViewsCount: 3,
      internalSavesCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const label = resolveCreatorLabel(videoWithoutIdentity);
    assert.equal(label, 'Creador de contenido');

    const adapted = adaptVideoSubmissionToTikTokVideo(videoWithoutIdentity);
    assert.equal(adapted.creator, 'Creador de contenido');
    assert.notEqual(adapted.creator, 'Administrador Principal de la Plataforma');
  });

  test('5. Schemas de administración admiten campos de creador externo', () => {
    const createData = {
      videoUrl: 'https://www.tiktok.com/@mochica_turismo/video/7123456789012345678',
      title: 'Recorrido Huacas del Sol y de la Luna',
      contentType: 'PLACE' as const,
      category: 'arqueologia',
      localityId: 'moche',
      creatorProfileId: null,
      externalCreatorHandle: 'mochica_turismo',
      externalCreatorDisplayName: 'Mochica Turismo y Aventura',
      externalCreatorAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      placeIds: ['huaca_de_la_luna'],
      status: 'APPROVED' as const,
    };

    const parseCreate = AdminCreateVideoSchema.safeParse(createData);
    assert.ok(parseCreate.success, 'AdminCreateVideoSchema debe validar exitosamente con campos de creador externo');
    assert.equal(parseCreate.data?.externalCreatorHandle, 'mochica_turismo');
    assert.equal(parseCreate.data?.externalCreatorDisplayName, 'Mochica Turismo y Aventura');

    const updateData = {
      externalCreatorHandle: 'mochica_actualizado',
      externalCreatorDisplayName: 'Mochica Actualizado',
    };
    const parseUpdate = AdminUpdateVideoSchema.safeParse(updateData);
    assert.ok(parseUpdate.success, 'AdminUpdateVideoSchema debe validar exitosamente campos de creador externo');
    assert.equal(parseUpdate.data?.externalCreatorHandle, 'mochica_actualizado');
  });

  test('6. MemoryCreatorsRepository persiste y recupera externalCreatorHandle en create y listApprovedVideos', async () => {
    const created = await memoryRepo.createSubmission(
      {
        userId: 'admin_usr_55',
        creatorProfileId: null,
        platform: 'tiktok',
        externalVideoId: '7234908123984719283',
        videoUrl: 'https://www.tiktok.com/@pacasmayo_surf/video/7234908123984719283',
        embedUrl: 'https://www.tiktok.com/embed/v2/7234908123984719283',
        title: 'Olas gigantes en Pacasmayo',
        contentType: 'PLACE',
        category: 'playas',
        localityId: 'pacasmayo',
        status: 'APPROVED',
        externalCreatorHandle: 'pacasmayo_surf',
        externalCreatorDisplayName: 'Pacasmayo Surf Club',
      },
      ['malecon_grau_pacasmayo']
    );

    assert.equal(created.externalCreatorHandle, 'pacasmayo_surf');
    assert.equal(created.externalCreatorDisplayName, 'Pacasmayo Surf Club');

    // List approved
    const listResult = await memoryRepo.listApprovedVideos();
    const found = listResult.videos.find((v) => v.id === created.id);
    assert.ok(found, 'Debe encontrar el video en la lista de aprobados');
    assert.equal(found?.externalCreatorHandle, 'pacasmayo_surf');
    assert.equal(found?.externalCreatorDisplayName, 'Pacasmayo Surf Club');

    // Adapted to public ranking
    const adapted = adaptVideoSubmissionToTikTokVideo(found!);
    assert.equal(adapted.creator, '@pacasmayo_surf');
  });

  test('7. mapVideoSubmissionRow de PostgreSQL extrae identidad externa desde external_metrics JSONB', () => {
    const rawPostgresRow = {
      id: 'vid_pg_101',
      userId: 'usr_admin_neon',
      creatorProfileId: null,
      platform: 'youtube',
      externalVideoId: 'dQw4w9WgXcQ',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      thumbnailUrl: null,
      title: 'Video en Otuzco',
      description: 'Hermosa fiesta patronal',
      contentType: 'PLACE',
      category: 'cultura',
      localityId: 'otuzco',
      status: 'APPROVED',
      moderationNotes: null,
      moderatedBy: 'usr_admin_neon',
      moderatedAt: new Date().toISOString(),
      internalViewsCount: 100,
      internalSavesCount: 25,
      externalMetrics: JSON.stringify({
        creatorHandle: 'otuzco_tradicion',
        creatorDisplayName: 'Otuzco Tradición y Fe',
        creatorAvatarUrl: null,
        views: 5000,
      }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creatorDisplayName: null,
      creatorHandle: null,
      creatorAvatarUrl: null,
      userName: 'Admin Neon Cloud Run',
    };

    const mapped = mapVideoSubmissionRow(rawPostgresRow);

    assert.equal(mapped.externalCreatorHandle, 'otuzco_tradicion');
    assert.equal(mapped.externalCreatorDisplayName, 'Otuzco Tradición y Fe');
    assert.equal(mapped.userName, 'Admin Neon Cloud Run');

    const label = resolveCreatorLabel(mapped);
    assert.equal(label, '@otuzco_tradicion');
    assert.notEqual(label, 'Admin Neon Cloud Run');
  });
});
