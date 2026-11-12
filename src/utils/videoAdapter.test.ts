import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptVideoSubmissionToTikTokVideo,
  resolveCreatorLabel,
  resolvePlaceName,
  resolveLocalityName,
  formatVideoDate,
  VideoSubmissionWithPlaces,
} from './videoAdapter.ts';
import { INITIAL_PLACES } from '../data/initialPlaces.ts';

describe('videoAdapter: Data Adaptation & Metrics Isolation', () => {
  const mockPlace = INITIAL_PLACES[0];

  test('resolveCreatorLabel resolves handle with @ prefix', () => {
    const labelWithAt = resolveCreatorLabel({
      creatorHandle: '@viajerotrujillano',
    } as any);
    assert.equal(labelWithAt, '@viajerotrujillano');

    const labelWithoutAt = resolveCreatorLabel({
      creatorHandle: 'cultura_norte',
    } as any);
    assert.equal(labelWithoutAt, '@cultura_norte');
  });

  test('resolveCreatorLabel prioritizes registered profile, external identity, and never admin userName', () => {
    // 1. Registered profile displayName when handle is null
    const labelDisplayName = resolveCreatorLabel({
      creatorHandle: null,
      creatorDisplayName: 'Rutas de La Libertad',
    } as any);
    assert.equal(labelDisplayName, 'Rutas de La Libertad');

    // 2. External creator handle
    const labelExternalHandle = resolveCreatorLabel({
      creatorHandle: null,
      creatorDisplayName: null,
      externalCreatorHandle: 'tiktok_viajero',
      userName: 'Admin Principal',
    } as any);
    assert.equal(labelExternalHandle, '@tiktok_viajero');

    // 2b. External creator in externalMetrics
    const labelExternalMetrics = resolveCreatorLabel({
      creatorHandle: null,
      creatorDisplayName: null,
      externalMetrics: { creatorHandle: '@turismo_moche', creatorDisplayName: 'Turismo Moche' },
      userName: 'Admin Principal',
    } as any);
    assert.equal(labelExternalMetrics, '@turismo_moche');

    // 2c. Extraction directly from TikTok videoUrl
    const labelFromUrl = resolveCreatorLabel({
      creatorHandle: null,
      creatorDisplayName: null,
      videoUrl: 'https://www.tiktok.com/@arqueologianorte/video/7391827391827391827',
      userName: 'Admin Gestor',
    } as any);
    assert.equal(labelFromUrl, '@arqueologianorte');

    // 3. Fallback when no handle or creator exists: NEVER uses admin userName
    const labelAdminIgnored = resolveCreatorLabel({
      creatorHandle: null,
      creatorDisplayName: null,
      videoUrl: 'https://www.instagram.com/p/C2xyz123/',
      userName: 'Admin Moderador Master',
    } as any);
    assert.equal(labelAdminIgnored, 'Creador de contenido');

    const labelDefault = resolveCreatorLabel({
      creatorHandle: null,
      creatorDisplayName: null,
      userName: null,
    } as any);
    assert.equal(labelDefault, 'Creador de contenido');
  });

  test('resolvePlaceName picks the first associated place or fallback', () => {
    assert.equal(
      resolvePlaceName({ places: [mockPlace] } as any),
      mockPlace.name
    );
    assert.equal(resolvePlaceName({ places: [] } as any), 'La Libertad');
    assert.equal(resolvePlaceName({} as any), 'La Libertad');
  });

  test('resolveLocalityName resolves locality through geo boundary catalog', () => {
    // Registered locality ID: 'huanchaco' -> 'Huanchaco'
    assert.equal(
      resolveLocalityName({ localityId: 'huanchaco' } as any),
      'Huanchaco'
    );
    // Fallback to place localityName
    assert.equal(
      resolveLocalityName({ localityId: null, places: [mockPlace] } as any),
      mockPlace.localityName
    );
    // Global fallback
    assert.equal(
      resolveLocalityName({ localityId: null, places: [] } as any),
      'La Libertad'
    );
  });

  test('formatVideoDate formats valid date cleanly and gracefully handles invalid dates', () => {
    const formatted = formatVideoDate('2026-11-12T10:00:00.000Z');
    assert.ok(formatted.length > 0);
    assert.notEqual(formatted, 'Invalid Date');

    assert.equal(formatVideoDate('not-a-date'), 'Reciente');
  });

  test('adaptVideoSubmissionToTikTokVideo strictly separates real external from internal metrics', () => {
    const submission: VideoSubmissionWithPlaces = {
      id: 'sub_123',
      userId: 'usr_456',
      creatorProfileId: 'cp_789',
      platform: 'tiktok',
      externalVideoId: '7192837482',
      videoUrl: 'https://www.tiktok.com/@viajerotrujillano/video/7192837482',
      embedUrl: 'https://www.tiktok.com/embed/v2/7192837482',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: 'Top 5 Atractivos en Trujillo',
      description: 'Recorrido por Chan Chan y Huacas del Sol',
      contentType: 'ROUTE',
      category: 'Cultura',
      localityId: 'trujillo',
      status: 'APPROVED',
      internalViewsCount: 42,
      internalSavesCount: 15,
      externalMetrics: {
        views: 125000,
        likes: 9800,
        comments: 340,
        recordedAt: '2026-11-10T12:00:00Z',
      },
      creatorHandle: 'viajerotrujillano',
      creatorDisplayName: 'Viajero Trujillano',
      userName: 'Juan Pérez',
      createdAt: '2026-11-10T12:00:00.000Z',
      updatedAt: '2026-11-10T12:00:00.000Z',
      places: [mockPlace],
    };

    const adapted = adaptVideoSubmissionToTikTokVideo(submission);

    // Verify creator, title, urls
    assert.equal(adapted.id, 'sub_123');
    assert.equal(adapted.creator, '@viajerotrujillano');
    assert.equal(adapted.placeName, mockPlace.name);
    assert.equal(adapted.locality, 'Trujillo');
    assert.equal(adapted.demo, false);

    // Verify external metrics
    assert.equal(adapted.externalViews, 125000);
    assert.equal(adapted.externalLikes, 9800);
    assert.equal(adapted.externalComments, 340);

    // Verify internal metrics
    assert.equal(adapted.internalViews, 42);
    assert.equal(adapted.internalSaves, 15);

    // Verify NO fake rating
    assert.equal(adapted.rating, 0);

    // Verify places association
    assert.equal(adapted.places?.length, 1);
    assert.equal(adapted.places?.[0]?.name, mockPlace.name);
  });

  test('adaptVideoSubmissionToTikTokVideo handles null external metrics without inventing stats', () => {
    const submission: VideoSubmissionWithPlaces = {
      id: 'sub_unverified',
      userId: 'usr_new',
      platform: 'tiktok',
      externalVideoId: '82910283',
      videoUrl: 'https://www.tiktok.com/@nuevo/video/82910283',
      embedUrl: 'https://www.tiktok.com/embed/v2/82910283',
      thumbnailUrl: null,
      title: 'Comida en Huanchaco',
      contentType: 'PLACE',
      category: 'Gastronomía',
      localityId: 'huanchaco',
      status: 'APPROVED',
      internalViewsCount: 5,
      internalSavesCount: 2,
      externalMetrics: null,
      creatorHandle: null,
      creatorDisplayName: null,
      userName: 'Ana Torres',
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
      places: [],
    };

    const adapted = adaptVideoSubmissionToTikTokVideo(submission);

    assert.equal(adapted.externalViews, null);
    assert.equal(adapted.externalLikes, null);
    assert.equal(adapted.externalComments, null);
    assert.equal(adapted.internalViews, 5);
    assert.equal(adapted.internalSaves, 2);
    assert.equal(adapted.creator, 'Ana Torres');
    assert.equal(adapted.placeName, 'La Libertad');
    assert.equal(adapted.locality, 'Huanchaco');
  });
});
