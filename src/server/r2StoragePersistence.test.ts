import test from 'node:test';
import assert from 'node:assert/strict';
import {
  uploadCreatorAvatar,
  deleteAvatar,
  getR2ConfigStatus,
  setMockS3Client,
} from './services/storageService.ts';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { MemoryCreatorsRepository } from './repositories/memoryCreatorsRepository.ts';

test('Cloudflare R2 Storage & Persistence Suite', async (t) => {
  const originalEnv = { ...process.env };

  t.afterEach(() => {
    // Restore environment and reset mock client after each subtest
    process.env = { ...originalEnv };
    setMockS3Client(null);
  });

  await t.test('1. Auditoría: Detecta variables ausentes y reporta estado unconfigured', () => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;

    const status = getR2ConfigStatus();
    assert.equal(status.isConfigured, false);
    assert.equal(status.mode, 'local');
    assert.equal(status.missingVariables.length, 5);
    assert.ok(status.missingVariables.includes('R2_ACCOUNT_ID'));
    assert.ok(status.missingVariables.includes('R2_ACCESS_KEY_ID'));
    assert.ok(status.missingVariables.includes('R2_SECRET_ACCESS_KEY'));
    assert.ok(status.missingVariables.includes('R2_BUCKET_NAME'));
    assert.ok(status.missingVariables.includes('R2_PUBLIC_URL'));
  });

  await t.test('2. Producción sin R2: No guarda silenciosamente en el sistema efímero de Cloud Run', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;

    const validJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    ]);

    await assert.rejects(
      async () => {
        await uploadCreatorAvatar(validJpeg, 'avatar_prod.jpg');
      },
      (err: Error) => {
        assert.match(err.message, /Cloudflare R2 no está configurado en producción/i);
        assert.match(err.message, /Cloud Run/i);
        return true;
      }
    );
  });

  await t.test('3. Subida R2: Ejecuta PutObjectCommand con bucket, key, buffer y contentType correctos', async () => {
    process.env.R2_ACCOUNT_ID = 'test_acc_123';
    process.env.R2_ACCESS_KEY_ID = 'test_key_abc';
    process.env.R2_SECRET_ACCESS_KEY = 'test_secret_xyz';
    process.env.R2_BUCKET_NAME = 'wayra-creators-media';
    process.env.R2_PUBLIC_URL = 'https://media.wayra.pe';

    const sentCommands: unknown[] = [];

    // Mock S3Client
    const mockClient = {
      send: async (command: unknown) => {
        sentCommands.push(command);
        return { $metadata: { httpStatusCode: 200 } };
      },
    } as unknown as S3Client;

    setMockS3Client(mockClient);

    const validPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ]);

    const result = await uploadCreatorAvatar(validPng, 'test_profile.png', 'image/png');

    assert.equal(result.storage, 'r2');
    assert.equal(result.mimeType, 'image/png');
    assert.match(result.filename, /^creator_avatar_\d+_[a-f0-9]+\.png$/);
    assert.match(result.url, /^https:\/\/media\.wayra\.pe\/avatars\/creator_avatar_\d+_[a-f0-9]+\.png$/);

    // Verify S3 Command was actually issued with correct parameters
    assert.equal(sentCommands.length, 1);
    const cmd = sentCommands[0] as PutObjectCommand;
    assert.equal(cmd.input.Bucket, 'wayra-creators-media');
    assert.equal(cmd.input.Key, `avatars/${result.filename}`);
    assert.equal(cmd.input.ContentType, 'image/png');
    assert.equal(cmd.input.CacheControl, 'public, max-age=31536000, immutable');
    assert.deepEqual(cmd.input.Body, validPng);
  });

  await t.test('4. Lectura mediante URL pública: La URL pública devuelta es navegable y sin secretos', async () => {
    process.env.R2_ACCOUNT_ID = 'test_acc_123';
    process.env.R2_ACCESS_KEY_ID = 'test_key_abc';
    process.env.R2_SECRET_ACCESS_KEY = 'test_secret_xyz';
    process.env.R2_BUCKET_NAME = 'wayra-creators-media';
    process.env.R2_PUBLIC_URL = 'https://media.wayra.pe';

    const mockClient = {
      send: async () => ({ $metadata: { httpStatusCode: 200 } }),
    } as unknown as S3Client;
    setMockS3Client(mockClient);

    const validJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    ]);

    const result = await uploadCreatorAvatar(validJpeg, 'avatar.jpg');
    assert.ok(result.url.startsWith('https://media.wayra.pe/avatars/'));
    assert.ok(!result.url.includes('test_key_abc'));
    assert.ok(!result.url.includes('test_secret_xyz'));
  });

  await t.test('5. Reemplazo controlado: La foto anterior se conserva si la nueva subida falla', async () => {
    const repo = new MemoryCreatorsRepository();
    const user = await repo.createUser({
      email: 'creator_replace@wayra.pe',
      passwordHash: 'hash_123',
      name: 'Elena Creadora',
    });

    // Profile originally has photo 1
    const originalAvatar = 'https://media.wayra.pe/avatars/creator_avatar_original.jpg';
    const profile = await repo.saveCreatorProfile({
      userId: user.id,
      handle: 'elenaviajera',
      displayName: 'Elena Viajera',
      primaryPlatform: 'tiktok',
      avatarUrl: originalAvatar,
      isPublic: true,
    });

    assert.equal(profile.avatarUrl, originalAvatar);

    // Simulate upload failure for new photo (e.g. S3 network failure in production)
    process.env.NODE_ENV = 'production';
    const failingMockClient = {
      send: async () => {
        throw new Error('Connection reset by Cloudflare R2 endpoint');
      },
    } as unknown as S3Client;
    setMockS3Client(failingMockClient);

    const newPhotoBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    ]);

    await assert.rejects(
      async () => {
        await uploadCreatorAvatar(newPhotoBuffer, 'new_photo.jpg');
      },
      (err: Error) => {
        assert.match(err.message, /Connection reset/i);
        return true;
      }
    );

    // Verify creator profile still has the original avatar in database
    const currentProfile = await repo.findCreatorProfileByHandle('elenaviajera');
    assert.equal(currentProfile?.avatarUrl, originalAvatar, 'La foto previa debe permanecer intacta ante fallos');
  });

  await t.test('6. Eliminación segura en R2: Emite DeleteObjectCommand para URLs autorizadas', async () => {
    process.env.R2_ACCOUNT_ID = 'test_acc_123';
    process.env.R2_ACCESS_KEY_ID = 'test_key_abc';
    process.env.R2_SECRET_ACCESS_KEY = 'test_secret_xyz';
    process.env.R2_BUCKET_NAME = 'wayra-creators-media';
    process.env.R2_PUBLIC_URL = 'https://media.wayra.pe';

    const deletedKeys: string[] = [];

    const mockClient = {
      send: async (command: unknown) => {
        const delCmd = command as DeleteObjectCommand;
        deletedKeys.push(delCmd.input.Key!);
        return { $metadata: { httpStatusCode: 204 } };
      },
    } as unknown as S3Client;

    setMockS3Client(mockClient);

    const validR2Url = 'https://media.wayra.pe/avatars/creator_avatar_1731429999_a1b2c3d4.jpg';
    const result = await deleteAvatar(validR2Url);

    assert.equal(result, true);
    assert.equal(deletedKeys.length, 1);
    assert.equal(deletedKeys[0], 'avatars/creator_avatar_1731429999_a1b2c3d4.jpg');
  });

  await t.test('7. Seguridad: Rechaza URLs arbitrarias o maliciosas en deleteAvatar', async () => {
    process.env.R2_PUBLIC_URL = 'https://media.wayra.pe';

    const mockClient = {
      send: async () => ({ $metadata: { httpStatusCode: 204 } }),
    } as unknown as S3Client;
    setMockS3Client(mockClient);

    // Arbitrary external domain
    const foreignDomain = await deleteAvatar('https://attacker.com/avatars/victim.jpg');
    assert.equal(foreignDomain, false, 'Debe rechazar dominios no configurados en R2_PUBLIC_URL');

    // Path outside /avatars/
    const wrongPath = await deleteAvatar('https://media.wayra.pe/database_dumps/secrets.sql');
    assert.equal(wrongPath, false, 'Debe rechazar rutas fuera de /avatars/');

    // Local directory traversal
    const traversal = await deleteAvatar('/uploads/avatars/../../etc/passwd');
    assert.equal(traversal, false, 'Debe rechazar directory traversal local');
  });

  await t.test('8. Error de conexión R2: Propaga error descriptivo sin filtrar credenciales', async () => {
    process.env.NODE_ENV = 'production';
    process.env.R2_ACCOUNT_ID = 'test_acc_123';
    process.env.R2_ACCESS_KEY_ID = 'test_key_secret_abc';
    process.env.R2_SECRET_ACCESS_KEY = 'super_secret_signing_key_999';
    process.env.R2_BUCKET_NAME = 'wayra-creators-media';
    process.env.R2_PUBLIC_URL = 'https://media.wayra.pe';

    const failingMockClient = {
      send: async () => {
        throw new Error('Endpoint connection timed out (ETIMEDOUT)');
      },
    } as unknown as S3Client;
    setMockS3Client(failingMockClient);

    const validJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    ]);

    await assert.rejects(
      async () => {
        await uploadCreatorAvatar(validJpeg, 'avatar_timeout.jpg');
      },
      (err: Error) => {
        assert.match(err.message, /ETIMEDOUT/);
        // Ensure secret keys are not leaked in the error
        assert.ok(!err.message.includes('super_secret_signing_key_999'));
        return true;
      }
    );
  });

  await t.test('9. Compatibilidad con almacenamiento local en desarrollo', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;

    const validJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    ]);

    const result = await uploadCreatorAvatar(validJpeg, 'dev_avatar.jpg');
    assert.equal(result.storage, 'local');
    assert.match(result.url, /^\/uploads\/avatars\/creator_avatar_\d+_[a-f0-9]+\.jpg$/);

    // Clean up
    await deleteAvatar(result.url);
  });
});
