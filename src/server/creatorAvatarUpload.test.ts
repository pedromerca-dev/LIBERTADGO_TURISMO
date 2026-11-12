import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  validateImageSignature,
  uploadCreatorAvatar,
  deleteLocalAvatar,
  getR2ConfigStatus,
  MAX_AVATAR_SIZE_BYTES,
} from './services/storageService.ts';
import { MemoryCreatorsRepository } from './repositories/memoryCreatorsRepository.ts';
import {
  AdminCreateCreatorSchema,
  AdminUpdateCreatorSchema,
} from './creatorsSchemas.ts';
import {
  adaptVideoSubmissionToTikTokVideo,
  resolveCreatorLabel,
} from '../utils/videoAdapter.ts';
import { VideoSubmission } from '../types/creators.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Manual Creator Photo Upload: Storage & Magic Bytes Validation', async (t) => {
  await t.test('detects valid JPEG, PNG and WebP magic bytes', () => {
    // Valid JPEG (FF D8 FF ...)
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48,
    ]);
    const jpegRes = validateImageSignature(jpegBuffer);
    assert.equal(jpegRes.isValid, true);
    assert.equal(jpegRes.detectedMime, 'image/jpeg');

    // Valid PNG (89 50 4E 47 0D 0A 1A 0A ...)
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ]);
    const pngRes = validateImageSignature(pngBuffer);
    assert.equal(pngRes.isValid, true);
    assert.equal(pngRes.detectedMime, 'image/png');

    // Valid WebP (RIFF .... WEBP)
    const webpBuffer = Buffer.alloc(20);
    webpBuffer.write('RIFF', 0, 4, 'ascii');
    webpBuffer.writeUInt32LE(12, 4);
    webpBuffer.write('WEBP', 8, 4, 'ascii');
    webpBuffer.write('VP8 ', 12, 4, 'ascii');
    const webpRes = validateImageSignature(webpBuffer);
    assert.equal(webpRes.isValid, true);
    assert.equal(webpRes.detectedMime, 'image/webp');
  });

  await t.test('rejects spoofed files (e.g. text/html renamed as .jpg)', () => {
    const fakeFile = Buffer.from('<!doctype html><html><body>malicious payload</body></html>');
    const res = validateImageSignature(fakeFile);
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /formato no soportado/i);
  });

  await t.test('rejects empty or corrupt buffers', () => {
    const tiny = Buffer.from([0x01, 0x02]);
    const res = validateImageSignature(tiny);
    assert.equal(res.isValid, false);
  });

  await t.test('rejects uploads exceeding 5 MB limit', async () => {
    // 5 MB + 1 byte
    const oversizedBuffer = Buffer.alloc(MAX_AVATAR_SIZE_BYTES + 1);
    // Write valid JPEG header so it would pass signature check if size weren't checked first
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;

    await assert.rejects(
      async () => {
        await uploadCreatorAvatar(oversizedBuffer, 'huge_avatar.jpg');
      },
      (err: Error) => {
        assert.match(err.message, /5 MB/);
        return true;
      }
    );
  });

  await t.test('uploads valid JPEG to local persistent storage and returns accessible URL', async () => {
    const validJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    ]);

    const result = await uploadCreatorAvatar(validJpeg, 'test_profile.jpg');

    assert.equal(result.storage, 'local');
    assert.equal(result.mimeType, 'image/jpeg');
    assert.match(result.url, /^\/uploads\/avatars\/creator_avatar_\d+_[a-f0-9]+\.jpg$/);

    // Verify physical file was written to disk
    const publicDir = path.resolve(__dirname, '../../public');
    const filePath = path.join(publicDir, result.url.replace(/^\//, ''));
    assert.equal(fs.existsSync(filePath), true, 'El archivo debe existir físicamente en public/uploads/avatars');

    // Clean up
    const deleted = await deleteLocalAvatar(result.url);
    assert.equal(deleted, true);
    assert.equal(fs.existsSync(filePath), false, 'El archivo debe eliminarse correctamente');
  });

  await t.test('deleteLocalAvatar protects against directory traversal', async () => {
    const attacked = await deleteLocalAvatar('/uploads/avatars/../../../etc/passwd');
    assert.equal(attacked, false);
  });
});

test('Cloudflare R2 Configuration Audit', async (t) => {
  await t.test('reports unconfigured status and missing environment variables', () => {
    const status = getR2ConfigStatus();
    // In this test environment, R2 is intentionally not set
    assert.equal(typeof status.isConfigured, 'boolean');
    assert.equal(Array.isArray(status.missingVariables), true);

    const requiredVars = [
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME',
      'R2_PUBLIC_URL',
    ];

    for (const v of requiredVars) {
      if (!process.env[v]) {
        assert.ok(status.missingVariables.includes(v));
      }
    }
  });
});

test('Creator Schema & Repository Persistence with Uploaded Avatar URL', async (t) => {
  const repo = new MemoryCreatorsRepository();

  const user = await repo.createUser({
    email: 'admin_test_avatar@wayra.pe',
    passwordHash: 'hashed_pw_xyz',
    name: 'Admin Test',
    role: 'ADMIN',
  });

  await t.test('AdminCreateCreatorSchema accepts /uploads/avatars/ path', () => {
    const payload = {
      userId: user.id,
      handle: 'trujillofoodie',
      displayName: 'Trujillo Foodie',
      avatarUrl: '/uploads/avatars/creator_avatar_1731420000_abc123.jpg',
      primaryPlatform: 'instagram' as const,
      isPublic: true,
    };

    const parsed = AdminCreateCreatorSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.avatarUrl, '/uploads/avatars/creator_avatar_1731420000_abc123.jpg');
    }
  });

  await t.test('AdminUpdateCreatorSchema accepts /uploads/avatars/ path or empty string', () => {
    const updatePayload = {
      avatarUrl: '/uploads/avatars/creator_avatar_1731420000_def456.webp',
    };
    const parsed = AdminUpdateCreatorSchema.safeParse(updatePayload);
    assert.equal(parsed.success, true);

    // Empty string allowed to clear avatar
    const emptyPayload = { avatarUrl: '' };
    const parsedEmpty = AdminUpdateCreatorSchema.safeParse(emptyPayload);
    assert.equal(parsedEmpty.success, true);
  });

  await t.test('saves creator profile with uploaded avatar and reloads correctly', async () => {
    const created = await repo.saveCreatorProfile({
      userId: user.id,
      handle: 'trujillofoodie',
      displayName: 'Trujillo Foodie',
      avatarUrl: '/uploads/avatars/creator_avatar_1731420000_abc123.jpg',
      primaryPlatform: 'instagram',
      isPublic: true,
    });

    assert.ok(created.id);
    assert.equal(created.avatarUrl, '/uploads/avatars/creator_avatar_1731420000_abc123.jpg');

    // Reload from repository
    const fetched = await repo.findCreatorProfileByHandle('trujillofoodie');
    assert.ok(fetched);
    assert.equal(fetched.avatarUrl, '/uploads/avatars/creator_avatar_1731420000_abc123.jpg');

    // Update with replaced avatar
    const updated = await repo.saveCreatorProfile({
      userId: user.id,
      handle: 'trujillofoodie',
      displayName: 'Trujillo Foodie',
      avatarUrl: '/uploads/avatars/creator_avatar_replaced_999.png',
      primaryPlatform: 'instagram',
      isPublic: true,
    });
    assert.equal(updated.avatarUrl, '/uploads/avatars/creator_avatar_replaced_999.png');

    // Reload again
    const fetchedUpdated = await repo.findCreatorProfileByHandle('trujillofoodie');
    assert.equal(fetchedUpdated?.avatarUrl, '/uploads/avatars/creator_avatar_replaced_999.png');

    // Delete/clear avatar
    const cleared = await repo.saveCreatorProfile({
      userId: user.id,
      handle: 'trujillofoodie',
      displayName: 'Trujillo Foodie',
      avatarUrl: null,
      primaryPlatform: 'instagram',
      isPublic: true,
    });
    assert.equal(cleared.avatarUrl, null);
  });
});

test('Card Visual Hierarchy Priority & Non-Administrator Identity Enforcement', async (t) => {
  const baseSubmission: VideoSubmission = {
    id: 'sub_test_1',
    userId: 'admin_user_456',
    userName: 'Admin Principal (Wayra Staff)', // Administrative user name
    creatorProfileId: 'cp_1',
    creatorHandle: 'peruvian_explorer',
    creatorDisplayName: 'Peruvian Explorer',
    creatorAvatarUrl: '/uploads/avatars/manual_wayra_photo.jpg',
    externalCreatorHandle: 'external_explorer',
    externalCreatorDisplayName: 'External Explorer',
    externalCreatorAvatarUrl: 'https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/external.jpeg',
    platform: 'tiktok',
    externalVideoId: '7411223344556677889',
    videoUrl: 'https://www.tiktok.com/@peruvian_explorer/video/7411223344556677889',
    embedUrl: 'https://www.tiktok.com/embed/v2/7411223344556677889',
    thumbnailUrl: 'https://images.unsplash.com/photo-chan-chan-ruins.jpg',
    title: 'Ruta por Chan Chan y Huanchaco',
    contentType: 'PLACE',
    category: 'Destinos',
    internalViewsCount: 0,
    internalSavesCount: 0,
    status: 'APPROVED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await t.test('Never presents administrative userName as original creator', () => {
    const label = resolveCreatorLabel(baseSubmission);
    assert.notEqual(label, 'Admin Principal (Wayra Staff)');
    assert.equal(label, '@peruvian_explorer');

    // Even if no creator profile or external handle exists, falls back to neutral label, NEVER admin name
    const anonSubmission: VideoSubmission = {
      ...baseSubmission,
      creatorHandle: undefined,
      creatorDisplayName: undefined,
      externalCreatorHandle: undefined,
      externalCreatorDisplayName: undefined,
      videoUrl: 'https://example.com/video/123',
    };
    const anonLabel = resolveCreatorLabel(anonSubmission);
    assert.notEqual(anonLabel, 'Admin Principal (Wayra Staff)');
    assert.equal(anonLabel, 'Creador de contenido');
  });

  await t.test('Priority 1: Official video thumbnail is populated when available', () => {
    const adapted = adaptVideoSubmissionToTikTokVideo(baseSubmission);
    assert.equal(adapted.thumbnailUrl, 'https://images.unsplash.com/photo-chan-chan-ruins.jpg');
    assert.equal(adapted.creatorAvatarUrl, '/uploads/avatars/manual_wayra_photo.jpg');
  });

  await t.test('Priority 2: Wayra manual creator photo is used when thumbnail is missing', () => {
    const noThumbSubmission: VideoSubmission = {
      ...baseSubmission,
      thumbnailUrl: null,
    };
    const adapted = adaptVideoSubmissionToTikTokVideo(noThumbSubmission);
    assert.equal(adapted.thumbnailUrl, undefined);
    // Wayra manual creator photograph takes priority
    assert.equal(adapted.creatorAvatarUrl, '/uploads/avatars/manual_wayra_photo.jpg');
  });

  await t.test('Priority 3: External creator avatar is used when Wayra manual photo is missing', () => {
    const noManualAvatarSubmission: VideoSubmission = {
      ...baseSubmission,
      thumbnailUrl: null,
      creatorAvatarUrl: null, // No manual photo uploaded yet
    };
    const adapted = adaptVideoSubmissionToTikTokVideo(noManualAvatarSubmission);
    assert.equal(adapted.thumbnailUrl, undefined);
    // Falls back to external avatar
    assert.equal(
      adapted.creatorAvatarUrl,
      'https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/external.jpeg'
    );
  });

  await t.test('Priority 4: creatorAvatarUrl is undefined when neither manual nor external avatar exists', () => {
    const noAvatarSubmission: VideoSubmission = {
      ...baseSubmission,
      thumbnailUrl: null,
      creatorAvatarUrl: null,
      externalCreatorAvatarUrl: null,
      externalMetrics: null,
    };
    const adapted = adaptVideoSubmissionToTikTokVideo(noAvatarSubmission);
    assert.equal(adapted.thumbnailUrl, undefined);
    assert.equal(adapted.creatorAvatarUrl, undefined);
    // When creatorAvatarUrl is undefined and thumbnailUrl is undefined,
    // TikTokVideoCard renders Priority 3 neutral styled initials
  });
});
