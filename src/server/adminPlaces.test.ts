import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlaceRepository, resetPlaceRepositoryForTesting } from './repositories/placeRepository.ts';
import { createToken, hashPassword } from './authService.ts';
import { getAuthRepository, resetRepositoriesForTesting } from './repositories/index.ts';

test('Place Repository & Admin Workflow Tests', async (t) => {
  resetPlaceRepositoryForTesting();
  const repo = getPlaceRepository();

  await t.test('1. Initial catalog loads exactly 297 verified places', async () => {
    const list = await repo.listPlaces({ limit: 400 });
    assert.equal(list.total, 297, `Expected exactly 297 places in initial seed, got ${list.total}`);
    assert.ok(list.places.length >= 297);
  });

  await t.test('2. Filtering by status: PUBLISHED returns all places initially', async () => {
    const published = await repo.listPlaces({ status: 'PUBLISHED', limit: 400 });
    assert.equal(published.total, 297);
    const drafts = await repo.listPlaces({ status: 'DRAFT' });
    assert.equal(drafts.total, 0);
  });

  await t.test('3. Admin can create a new place with validation and audit log', async () => {
    const newPlace = await repo.createPlace(
      {
        name: 'Nuevo Restaurante Mochica',
        category: 'restaurantes',
        localityId: 'moche',
        localityName: 'Moche',
        address: 'Campiña de Moche s/n',
        coordinates: { lat: -8.1705, lng: -79.0062 },
        shortDescription: 'Excelente comida típica tradicional norteña y sopa teóloga.',
        status: 'PUBLISHED',
      },
      'admin_user_1',
      'Pedro Admin'
    );

    assert.ok(newPlace.id);
    assert.equal(newPlace.name, 'Nuevo Restaurante Mochica');
    assert.equal(newPlace.localityId, 'moche');

    // Total should now be 298
    const updatedList = await repo.listPlaces({ limit: 400 });
    assert.equal(updatedList.total, 298);

    // Audit log was recorded
    const logs = await repo.getAuditLogs(newPlace.id);
    assert.ok(logs.length >= 1);
    assert.equal(logs[0].action, 'CREATE');
    assert.equal(logs[0].adminName, 'Pedro Admin');
  });

  await t.test('4. Admin can update place fields and change status to ARCHIVED', async () => {
    const place = (await repo.listPlaces({ limit: 1 })).places[0];
    const originalStatus = place.status;

    const updated = await repo.updateStatus(place.id, 'ARCHIVED', 'admin_user_1', 'Pedro Admin', 'Cierre temporal');
    assert.ok(updated);
    assert.equal(updated.status, 'ARCHIVED');

    // Public catalog should NOT include archived place
    const publicPlaces = await repo.getPublicPlaces();
    assert.ok(!publicPlaces.some((p) => p.id === place.id));

    // Audit trail has ARCHIVE action
    const logs = await repo.getAuditLogs(place.id);
    assert.ok(logs.some((l) => l.action === 'ARCHIVE'));

    // Revert status to PUBLISHED
    await repo.updateStatus(place.id, originalStatus, 'admin_user_1', 'Pedro Admin', 'Reapertura');
  });

  await t.test('5. Admin can update verification level and notes', async () => {
    const place = (await repo.listPlaces({ limit: 1 })).places[0];
    const verified = await repo.verifyPlace(
      place.id,
      true,
      'official_mincetur',
      'Validado con directorio regional oficial 2026',
      'admin_user_1',
      'Pedro Admin'
    );

    assert.ok(verified);
    assert.equal(verified.verification.isVerified, true);
    assert.equal(verified.verification.verificationLevel, 'official_mincetur');
    assert.equal(verified.verification.verifiedBy, 'Pedro Admin');
  });

  await t.test('6. Dashboard metrics aggregate correctly', async () => {
    const metrics = await repo.getDashboardMetrics();
    assert.ok(metrics.totalPlaces >= 297);
    assert.ok(metrics.placesByCategory.length > 0);
    assert.ok(metrics.placesByLocality.length >= 10);
    assert.ok(metrics.sourcesDistribution.length > 0);
    assert.ok(Array.isArray(metrics.recentAuditLogs));
  });

  await t.test('7. Duplicate detection identifies nearby identical places and supports merge', async () => {
    // Intentionally create a duplicate place
    const dup = await repo.createPlace(
      {
        name: 'Museo de Sitio de Chan Chan (Duplicado OSM)',
        category: 'museos',
        localityId: 'huanchaco',
        localityName: 'Huanchaco',
        address: 'Carretera Huanchaco Km 4.5',
        coordinates: { lat: -8.0999, lng: -79.0683 }, // 15 meters from Museo de Sitio de Chan Chan
        shortDescription: 'Museo de sitio arqueológico Chan Chan duplicado para test',
      },
      'admin_user_1',
      'Pedro Admin'
    );

    const duplicates = await repo.findDuplicates();
    assert.ok(duplicates.length > 0, 'Expected at least 1 duplicate candidate');

    // Find pair containing the new place
    const pair = duplicates.find((d: { primaryPlace: { id: string }; duplicatePlace: { id: string } }) => d.primaryPlace.id === dup.id || d.duplicatePlace.id === dup.id);
    assert.ok(pair, 'Duplicate pair was found');

    const primaryId = pair.primaryPlace.id === dup.id ? pair.duplicatePlace.id : pair.primaryPlace.id;
    const dupId = dup.id;

    const mergeResult = await repo.mergeDuplicates(primaryId, [dupId], 'admin_user_1', 'Pedro Admin');
    assert.ok(mergeResult.success);
    assert.equal(mergeResult.mergedCount, 1);

    // Duplicate should now be ARCHIVED
    const archivedDup = await repo.getPlaceById(dupId);
    assert.equal(archivedDup?.status, 'ARCHIVED');
  });
});
