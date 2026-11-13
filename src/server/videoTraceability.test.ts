import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthRepository, getCreatorsRepository } from './repositories/index.ts';
import { hashPassword } from './authService.ts';
import {
  serializeInternalNotes,
  parseModerationLogRow,
} from './repositories/postgresCreatorsRepository.ts';
import { ModerationAuditPayload } from '../types/creators.ts';

test('Video Traceability & Audit: Direct APPROVED creation registers action CREATE with previousStatus null', async () => {
  const authRepo = getAuthRepository();
  const repo = getCreatorsRepository();

  const admin = await authRepo.createUser({
    email: 'admin.traceability@libertadgo.pe',
    passwordHash: hashPassword('Pass1234!'),
    name: 'Admin Auditor',
    role: 'ADMIN',
  });

  const auditPayload: ModerationAuditPayload = {
    adminUserId: admin.id,
    adminName: admin.name,
    action: 'CREATE',
    previousStatus: null,
    newStatus: 'APPROVED',
    reason: 'Registro y publicación directa desde el panel de administración',
    internalNotes: 'Creación directa autorizada',
  };

  const video = await repo.createSubmission(
    {
      userId: admin.id,
      creatorProfileId: null,
      platform: 'tiktok',
      externalVideoId: '7499887766554433221',
      videoUrl: 'https://www.tiktok.com/@rutamoche/video/7499887766554433221',
      embedUrl: 'https://www.tiktok.com/embed/v2/7499887766554433221',
      thumbnailUrl: null,
      title: 'Caballitos de Totora al amanecer',
      description: 'Pescadores tradicionales en Huanchaco',
      contentType: 'PLACE',
      category: 'aventura',
      localityId: 'huanchaco',
      status: 'APPROVED',
    },
    ['place_chan_chan'],
    'place_chan_chan',
    auditPayload
  );

  assert.equal(video.status, 'APPROVED');

  // Verify audit log
  const logs = await repo.getModerationLogs(video.id);
  assert.equal(logs.length, 1);
  const log = logs[0];

  assert.equal(log.videoId, video.id);
  assert.equal(log.adminUserId, admin.id);
  assert.equal(log.adminName, 'Admin Auditor');
  assert.equal(log.action, 'CREATE');
  assert.equal(log.previousStatus, null, 'Direct creation MUST have previousStatus null, not fictitious PENDING');
  assert.equal(log.newStatus, 'APPROVED');
  assert.equal(log.reason, 'Registro y publicación directa desde el panel de administración');
  assert.equal(log.internalNotes, 'Creación directa autorizada');
});

test('Video Traceability & Audit: Video UPDATE records action UPDATE and identifies changedFields', async () => {
  const authRepo = getAuthRepository();
  const repo = getCreatorsRepository();

  const admin = await authRepo.findUserByEmail('admin.traceability@libertadgo.pe');
  assert.ok(admin);

  // Create initial video in PENDING state
  const initialVideo = await repo.createSubmission({
    userId: admin.id,
    creatorProfileId: null,
    platform: 'youtube',
    externalVideoId: 'dQw4w9WgXcQ',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnailUrl: null,
    title: 'Titulo Borrador',
    description: 'Borrador de descripcion',
    contentType: 'GENERAL',
    category: 'naturaleza',
    localityId: 'otuzco',
    status: 'PENDING',
  });

  const changedFields = ['title', 'category', 'description'];
  const updateAudit: ModerationAuditPayload = {
    adminUserId: admin.id,
    adminName: admin.name,
    action: 'UPDATE',
    previousStatus: initialVideo.status,
    newStatus: initialVideo.status,
    reason: 'Corrección editorial de ortografía y taxonomía',
    internalNotes: 'Alineado a la guía de estilo regional',
    changedFields,
  };

  const updatedVideo = await repo.updateSubmission(
    initialVideo.id,
    {
      title: 'Santuario de la Virgen de la Puerta en Otuzco',
      category: 'arqueologia',
      description: 'Tradición y festividad patronal en la sierra liberteña',
    },
    ['place_chan_chan'],
    'place_chan_chan',
    updateAudit
  );

  assert.ok(updatedVideo);
  assert.equal(updatedVideo.title, 'Santuario de la Virgen de la Puerta en Otuzco');
  assert.equal(updatedVideo.category, 'arqueologia');

  const logs = await repo.getModerationLogs(initialVideo.id);
  assert.ok(logs.length >= 1);
  const editLog = logs[0];

  assert.equal(editLog.action, 'UPDATE');
  assert.equal(editLog.previousStatus, 'PENDING');
  assert.equal(editLog.newStatus, 'PENDING');
  assert.deepEqual(editLog.changedFields, ['title', 'category', 'description']);
  assert.equal(editLog.internalNotes, 'Alineado a la guía de estilo regional');
});

test('Video Traceability & Audit: Moderation action APPROVE / REJECT records transitions and actions', async () => {
  const authRepo = getAuthRepository();
  const repo = getCreatorsRepository();

  const admin = await authRepo.findUserByEmail('admin.traceability@libertadgo.pe');
  assert.ok(admin);

  const video = await repo.createSubmission({
    userId: admin.id,
    creatorProfileId: null,
    platform: 'tiktok',
    externalVideoId: '7112233445566778899',
    videoUrl: 'https://www.tiktok.com/@gastronomiatrujillo/video/7112233445566778899',
    embedUrl: 'https://www.tiktok.com/embed/v2/7112233445566778899',
    title: 'Cebiche trujillano con zarandaja y mococho',
    contentType: 'PLACE',
    category: 'gastronomia',
    status: 'PENDING',
  });

  const approveAudit: ModerationAuditPayload = {
    adminUserId: admin.id,
    adminName: admin.name,
    action: 'APPROVE',
    previousStatus: 'PENDING',
    newStatus: 'APPROVED',
    reason: 'Cumple con estándares de calidad audiovisual y veracidad turística',
    internalNotes: 'Aprobado para portada gastronómica',
  };

  const approved = await repo.updateSubmissionStatus(
    video.id,
    'APPROVED',
    approveAudit.reason,
    admin.id,
    approveAudit,
    ['place_chan_chan']
  );

  assert.ok(approved);
  assert.equal(approved.status, 'APPROVED');

  const logs = await repo.getModerationLogs(video.id);
  const approveLog = logs[0];

  assert.equal(approveLog.action, 'APPROVE');
  assert.equal(approveLog.previousStatus, 'PENDING');
  assert.equal(approveLog.newStatus, 'APPROVED');
  assert.equal(approveLog.reason, 'Cumple con estándares de calidad audiovisual y veracidad turística');
});

test('Video Traceability & Audit: Serialization and Parsing preserves action, changedFields, and clean notes without database alterations', () => {
  const originalNotes = 'Revisado por control de calidad turística';
  const changedFields = ['title', 'thumbnailUrl', 'localityId'];

  const serialized = serializeInternalNotes('UPDATE', changedFields, originalNotes);
  assert.ok(serialized.includes('__AUDIT_META__:'));
  assert.ok(serialized.includes(originalNotes));

  const parsed = parseModerationLogRow({
    id: 'mod_123',
    videoId: 'vid_456',
    adminUserId: 'usr_789',
    adminName: 'Admin Inspector',
    previousStatus: 'PENDING',
    newStatus: 'APPROVED',
    reason: 'Aprobado',
    internalNotes: serialized,
    createdAt: new Date('2026-06-01T12:00:00Z'),
  });

  assert.equal(parsed.action, 'UPDATE');
  assert.deepEqual(parsed.changedFields, ['title', 'thumbnailUrl', 'localityId']);
  assert.equal(parsed.internalNotes, originalNotes);
  assert.equal(parsed.previousStatus, 'PENDING');

  // Test row with previousStatus 'NONE' (PostgreSQL fallback when previousStatus is null)
  const directCreationParsed = parseModerationLogRow({
    id: 'mod_create',
    videoId: 'vid_111',
    adminUserId: 'usr_789',
    adminName: 'Admin Inspector',
    previousStatus: 'NONE',
    newStatus: 'APPROVED',
    reason: 'Creación directa',
    internalNotes: serializeInternalNotes('CREATE', null, 'Nota directa'),
    createdAt: new Date('2026-06-01T12:00:00Z'),
  });

  assert.equal(directCreationParsed.action, 'CREATE');
  assert.equal(directCreationParsed.previousStatus, null);
  assert.equal(directCreationParsed.newStatus, 'APPROVED');
  assert.equal(directCreationParsed.internalNotes, 'Nota directa');
});
