import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { catalogRepository } from './repository.ts';
import { getPlaceRepository, resetPlaceRepositoryForTesting } from './repositories/placeRepository.ts';
import {
  createToken,
  verifyToken,
  revokeToken,
  isTokenRevoked,
  authMiddleware,
  clearRevokedTokensForTesting,
} from './authService.ts';

describe('Security & Persistence Remediation Tests', () => {
  beforeEach(() => {
    resetPlaceRepositoryForTesting();
    clearRevokedTokensForTesting();
  });

  describe('Etapa 4: Public Catalog Isolation', () => {
    test('PUBLISHED places are accessible to the public', () => {
      const places = catalogRepository.getPlaces();
      assert.ok(places.length > 0, 'Catalog should contain public places');
      const first = places[0];

      const retrieved = catalogRepository.getPlaceById(first.id);
      assert.ok(retrieved, 'Should retrieve published place by ID');
      assert.equal(retrieved?.id, first.id);
    });

    test('ARCHIVED, DRAFT or FLAGGED places are strictly isolated from public catalog', () => {
      const repo = getPlaceRepository();
      // Create a test draft place
      const draftPlace = repo.createPlace(
        {
          name: 'Restaurante Oculto Borrador',
          category: 'restaurantes',
          localityId: 'trujillo',
          address: 'Calle Secreta 123, Trujillo',
          coordinates: { lat: -8.1116, lng: -79.0287 },
          status: 'DRAFT',
        },
        'test_admin',
        'Admin Tester'
      );

      // Verify it exists in admin repository
      const inAdmin = repo.getPlaceById(draftPlace.id);
      assert.ok(inAdmin, 'Draft place must exist in admin repo');
      assert.equal(inAdmin?.status, 'DRAFT');

      // Verify public catalog isolation: MUST return undefined (which yields 404 in public API)
      const inPublic = catalogRepository.getPlaceById(draftPlace.id);
      assert.equal(inPublic, undefined, 'Public catalog getPlaceById MUST return undefined for DRAFT places');

      // Update to ARCHIVED and verify isolation persists
      repo.updateStatus(draftPlace.id, 'ARCHIVED', 'test_admin', 'Admin Tester', 'Testing archive');
      const inPublicArchived = catalogRepository.getPlaceById(draftPlace.id);
      assert.equal(inPublicArchived, undefined, 'Public catalog getPlaceById MUST return undefined for ARCHIVED places');

      // Update to PUBLISHED and verify it becomes accessible
      repo.updateStatus(draftPlace.id, 'PUBLISHED', 'test_admin', 'Admin Tester', 'Approving publication');
      const inPublicPublished = catalogRepository.getPlaceById(draftPlace.id);
      assert.ok(inPublicPublished, 'Public catalog getPlaceById MUST return place once status is PUBLISHED');
      assert.equal(inPublicPublished?.id, draftPlace.id);
    });
  });

  describe('Etapa 5: Session Security & Token Revocation', () => {
    test('Signed session token can be created, verified, and payload inspected', () => {
      const token = createToken({
        id: 'user_sec_1',
        email: 'user@test.pe',
        name: 'Usuario Seguro',
        role: 'USER',
      });

      const payload = verifyToken(token);
      assert.ok(payload, 'Token should verify successfully');
      assert.equal(payload?.userId, 'user_sec_1');
      assert.equal(payload?.role, 'USER');
      assert.equal(payload?.email, 'user@test.pe');
    });

    test('Revoked token is rejected by isTokenRevoked and authMiddleware', async () => {
      const token = createToken({
        id: 'user_sec_2',
        email: 'logout@test.pe',
        name: 'Usuario Logout',
        role: 'USER',
      });

      // Before revocation
      const isRevBefore = await isTokenRevoked(token);
      assert.equal(isRevBefore, false, 'Fresh token must not be revoked');

      // Simulate authentication middleware before logout
      const mockReqBefore: any = { headers: { authorization: `Bearer ${token}` } };
      const mockRes: any = {};
      let nextCalled = false;
      await authMiddleware(mockReqBefore, mockRes, () => {
        nextCalled = true;
      });
      assert.ok(nextCalled);
      assert.ok(mockReqBefore.user, 'Active token should populate req.user');
      assert.equal(mockReqBefore.user.userId, 'user_sec_2');

      // Now revoke the token (simulate /logout)
      await revokeToken(token, 'user_sec_2');

      const isRevAfter = await isTokenRevoked(token);
      assert.equal(isRevAfter, true, 'Revoked token must be detected as revoked');

      // Simulate authentication middleware after logout
      const mockReqAfter: any = { headers: { authorization: `Bearer ${token}` } };
      let nextCalledAfter = false;
      await authMiddleware(mockReqAfter, mockRes, () => {
        nextCalledAfter = true;
      });
      assert.ok(nextCalledAfter);
      assert.equal(mockReqAfter.user, undefined, 'Revoked token must NOT populate req.user');
    });

    test('Supports extraction from libertadgo_token cookie', async () => {
      const token = createToken({
        id: 'user_sec_cookie',
        email: 'cookie@test.pe',
        name: 'Cookie User',
        role: 'ADMIN',
      });

      const mockReq: any = {
        headers: {
          cookie: `theme=dark; libertadgo_token=${token}; other=value`,
        },
      };
      await authMiddleware(mockReq, {} as any, () => {});
      assert.ok(mockReq.user, 'Cookie token must authenticate');
      assert.equal(mockReq.user.userId, 'user_sec_cookie');
      assert.equal(mockReq.user.role, 'ADMIN');
    });
  });

  describe('Etapa 6: ACID Transactions & Deduplication Rules', () => {
    test('Deduplication correctly detects nearby identical names', () => {
      const repo = getPlaceRepository();

      // Create two places with identical names and close coordinates
      const p1 = repo.createPlace(
        {
          name: 'Huaca del Sol y de la Luna Tour',
          category: 'arqueologia',
          localityId: 'moche',
          address: 'Campiña de Moche s/n',
          coordinates: { lat: -8.1345, lng: -78.9922 },
          status: 'PUBLISHED',
        },
        'admin1',
        'Admin'
      );

      const p2 = repo.createPlace(
        {
          name: 'Huaca del Sol y de la Luna (Moche)',
          category: 'arqueologia',
          localityId: 'moche',
          address: 'Valle de Moche',
          coordinates: { lat: -8.1350, lng: -78.9925 }, // approx 60m away
          status: 'PUBLISHED',
        },
        'admin1',
        'Admin'
      );

      const duplicates = repo.findDuplicates();
      const match = duplicates.find(
        (d) =>
          (d.primaryPlace?.id === p1.id && d.duplicatePlace?.id === p2.id) ||
          (d.primaryPlace?.id === p2.id && d.duplicatePlace?.id === p1.id)
      );

      assert.ok(match, 'Should detect duplicate pair due to spatial proximity and string similarity');
      assert.ok(match.similarityScore >= 0.7, 'Similarity score should be >= 0.7');
      assert.ok(match.distanceMeters < 350, 'Distance should be under 350m');
    });

    test('Merge duplicates archives duplicate place and creates audit record', () => {
      const repo = getPlaceRepository();

      const primary = repo.createPlace(
        {
          name: 'Chan Chan - Palacio Nik An Principal',
          category: 'arqueologia',
          localityId: 'huanchaco',
          address: 'Carretera a Huanchaco Km 5',
          coordinates: { lat: -8.1086, lng: -79.0735 },
          status: 'PUBLISHED',
        },
        'admin1',
        'Admin'
      );

      const dup = repo.createPlace(
        {
          name: 'Chan Chan Palacio Tschudi Duplicado',
          category: 'arqueologia',
          localityId: 'huanchaco',
          address: 'Huanchaco',
          coordinates: { lat: -8.1090, lng: -79.0740 },
          status: 'PUBLISHED',
        },
        'admin1',
        'Admin'
      );

      const mergeResult = repo.mergeDuplicates(
        primary.id,
        [dup.id],
        'admin_merger',
        'Admin Merger'
      );

      assert.equal(mergeResult.success, true);
      assert.equal(mergeResult.mergedCount, 1);

      // Verify duplicate is now ARCHIVED
      const archivedDup = repo.getPlaceById(dup.id);
      assert.equal(archivedDup?.status, 'ARCHIVED');

      // Verify audit trail logged the merge
      const logs = repo.getAuditLogs(primary.id);
      assert.ok(logs.some((l) => l.action === 'MERGE'), 'Audit trail should include MERGE action');
    });
  });
});
