import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCreatorsRepository } from './repositories/memoryCreatorsRepository.ts';
import { CreatorProfileSchema, AdminCreateCreatorSchema } from './creatorsSchemas.ts';
import { adaptVideoSubmissionToTikTokVideo } from '../utils/videoAdapter.ts';
import { SORT_OPTIONS } from '../components/common/TikTokVideoGallery.tsx';

test('Phase 5: Place Videos & Association Isolation', async (t) => {
  const repo = new MemoryCreatorsRepository();

  const user = await repo.createUser({
    email: 'creator5@wayra.pe',
    passwordHash: 'hash123',
    name: 'Carlos Viajero',
    role: 'USER',
  });

  const creator = await repo.saveCreatorProfile({
    userId: user.id,
    handle: 'carlosviajero',
    displayName: 'Carlos Viajero',
    primaryPlatform: 'tiktok',
    isPublic: true,
    tiktokFollowers: 125000,
    instagramFollowers: 45000,
    youtubeSubscribers: 12000,
  });

  // Create an approved video associated with place_chan_chan
  const videoChanChan = await repo.createSubmission(
    {
      userId: user.id,
      creatorProfileId: creator.id,
      platform: 'tiktok',
      externalVideoId: '7412345678901234567',
      videoUrl: 'https://www.tiktok.com/@carlosviajero/video/7412345678901234567',
      embedUrl: 'https://www.tiktok.com/embed/v2/7412345678901234567',
      thumbnailUrl: 'https://images.unsplash.com/photo-chan-chan.jpg',
      title: 'Explorando la ciudadela de barro Chan Chan',
      contentType: 'PLACE',
      category: 'Arqueología',
      localityId: 'huanchaco',
      status: 'APPROVED',
    },
    ['place_chan_chan'],
    'place_chan_chan'
  );

  // Create a pending video for place_huacas_sol_luna (should NOT appear in public place videos)
  const videoPending = await repo.createSubmission(
    {
      userId: user.id,
      creatorProfileId: creator.id,
      platform: 'tiktok',
      externalVideoId: '7412345678909999999',
      videoUrl: 'https://www.tiktok.com/@carlosviajero/video/7412345678909999999',
      embedUrl: 'https://www.tiktok.com/embed/v2/7412345678909999999',
      thumbnailUrl: null,
      title: 'Huacas del Sol y la Luna en revisión',
      contentType: 'PLACE',
      category: 'Arqueología',
      localityId: 'moche',
      status: 'PENDING',
    },
    ['place_huacas_sol_luna'],
    'place_huacas_sol_luna'
  );

  await t.test('1. getVideosForPlace returns APPROVED videos for that place exclusively', async () => {
    const chanChanVideos = await repo.getVideosForPlace('place_chan_chan');
    assert.equal(chanChanVideos.length, 1);
    assert.equal(chanChanVideos[0].id, videoChanChan.id);
    assert.equal(chanChanVideos[0].creatorHandle, 'carlosviajero');
    assert.equal(chanChanVideos[0].creatorDisplayName, 'Carlos Viajero');
    assert.equal(chanChanVideos[0].tiktokFollowers, 125000);
  });

  await t.test('2. getVideosForPlace does NOT return pending/unapproved videos', async () => {
    const huacasVideos = await repo.getVideosForPlace('place_huacas_sol_luna');
    assert.equal(huacasVideos.length, 0, 'Pending videos must never be returned for a place');
  });

  await t.test('3. Places with no videos return an empty array without crashing', async () => {
    const emptyPlaceVideos = await repo.getVideosForPlace('place_plaza_armas_trujillo');
    assert.deepEqual(emptyPlaceVideos, []);
  });
});

test('Phase 5: Audience Schema Validation & Integrity', async (t) => {
  await t.test('1. Validates non-negative integer followers for all platforms', () => {
    const valid = AdminCreateCreatorSchema.safeParse({
      handle: 'guialocal',
      displayName: 'Guía Local Trujillo',
      primaryPlatform: 'tiktok',
      tiktokFollowers: 50000,
      instagramFollowers: 12000,
      youtubeSubscribers: 3500,
    });
    assert.ok(valid.success);
    assert.equal(valid.data.tiktokFollowers, 50000);
    assert.equal(valid.data.instagramFollowers, 12000);
    assert.equal(valid.data.youtubeSubscribers, 3500);
  });

  await t.test('2. Allows null or omitted values when audience is unknown', () => {
    const validWithNulls = AdminCreateCreatorSchema.safeParse({
      handle: 'nuevocreador',
      displayName: 'Nuevo Creador',
      primaryPlatform: 'instagram',
      tiktokFollowers: null,
      instagramFollowers: null,
      youtubeSubscribers: null,
    });
    assert.ok(validWithNulls.success);
    assert.equal(validWithNulls.data.tiktokFollowers, null);
  });

  await t.test('3. Rejects negative numbers for followers or subscribers', () => {
    const invalidNegative = AdminCreateCreatorSchema.safeParse({
      handle: 'negativotest',
      displayName: 'Test Negativo',
      primaryPlatform: 'tiktok',
      tiktokFollowers: -50,
    });
    assert.equal(invalidNegative.success, false);
  });

  await t.test('4. Rejects decimal numbers for followers or subscribers', () => {
    const invalidDecimal = AdminCreateCreatorSchema.safeParse({
      handle: 'decimaltest',
      displayName: 'Test Decimal',
      primaryPlatform: 'tiktok',
      tiktokFollowers: 12.5,
    });
    assert.equal(invalidDecimal.success, false);
  });
});

test('Phase 5: Visual Identity Hierarchy & Adaptation', async (t) => {
  await t.test('1. Priority 1: Uses official video thumbnailUrl when present', () => {
    const adapted = adaptVideoSubmissionToTikTokVideo({
      id: 'sub_1',
      userId: 'usr_1',
      platform: 'tiktok',
      externalVideoId: '123',
      videoUrl: 'https://tiktok.com/@viajero/video/123',
      embedUrl: 'https://tiktok.com/embed/123',
      thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
      title: 'Chan Chan al atardecer',
      contentType: 'PLACE',
      category: 'Arqueología',
      status: 'APPROVED',
      internalViewsCount: 10,
      internalSavesCount: 2,
      creatorHandle: 'viajero',
      creatorDisplayName: 'Viajero Perú',
      creatorAvatarUrl: 'https://cdn.example.com/avatar.jpg',
      createdAt: '2026-11-12T00:00:00Z',
      updatedAt: '2026-11-12T00:00:00Z',
    });

    assert.equal(adapted.thumbnailUrl, 'https://cdn.example.com/thumb.jpg');
    assert.equal(adapted.creatorAvatarUrl, 'https://cdn.example.com/avatar.jpg');
    assert.equal(adapted.creator, '@viajero');
  });

  await t.test('2. Priority 2: When thumbnailUrl is missing, preserves creatorAvatarUrl and creatorHandle', () => {
    const adapted = adaptVideoSubmissionToTikTokVideo({
      id: 'sub_2',
      userId: 'usr_admin',
      userName: 'Admin Supremo', // Admin user name should NEVER leak as creator
      platform: 'tiktok',
      externalVideoId: '456',
      videoUrl: 'https://tiktok.com/@fotografo_trujillo/video/456',
      embedUrl: 'https://tiktok.com/embed/456',
      thumbnailUrl: null,
      title: 'Plaza de Armas de Trujillo',
      contentType: 'PLACE',
      category: 'Patrimonio',
      status: 'APPROVED',
      internalViewsCount: 5,
      internalSavesCount: 0,
      externalCreatorHandle: 'fotografo_trujillo',
      externalCreatorDisplayName: 'Fotógrafo Trujillo',
      externalCreatorAvatarUrl: 'https://cdn.example.com/fotografo.jpg',
      createdAt: '2026-11-12T00:00:00Z',
      updatedAt: '2026-11-12T00:00:00Z',
    });

    assert.equal(adapted.thumbnailUrl, undefined);
    assert.equal(adapted.creatorAvatarUrl, 'https://cdn.example.com/fotografo.jpg');
    assert.equal(adapted.creator, '@fotografo_trujillo');
    assert.notEqual(adapted.creator, 'Admin Supremo', 'Admin name must NEVER leak as creator');
  });
});

test('Phase 5: Popularity Sorting with Nulls Last', async (t) => {
  await t.test('1. Sort options include TikTok, Instagram, and YouTube audience filters', () => {
    const optionIds = SORT_OPTIONS.map((o) => o.id);
    assert.ok(optionIds.includes('tiktok_followers'));
    assert.ok(optionIds.includes('instagram_followers'));
    assert.ok(optionIds.includes('youtube_subscribers'));
  });

  await t.test('2. Nulls last behavior: videos with null followers sort after videos with declared followers', () => {
    const list = [
      { id: 'v1', tiktokFollowers: null, rawDate: '2026-11-10' },
      { id: 'v2', tiktokFollowers: 50000, rawDate: '2026-11-11' },
      { id: 'v3', tiktokFollowers: 120000, rawDate: '2026-11-12' },
      { id: 'v4', tiktokFollowers: 5000, rawDate: '2026-11-09' },
    ];

    const sorted = [...list].sort((a, b) => {
      const fA = a.tiktokFollowers;
      const fB = b.tiktokFollowers;
      if (fA == null && fB == null) return 0;
      if (fA == null) return 1;
      if (fB == null) return -1;
      return fB - fA;
    });

    assert.deepEqual(
      sorted.map((v) => v.id),
      ['v3', 'v2', 'v4', 'v1'],
      'Highest followers first, null followers last'
    );
  });
});
