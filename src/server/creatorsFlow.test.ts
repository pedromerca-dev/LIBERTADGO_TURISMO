import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthRepository, getCreatorsRepository } from './repositories/index.ts';
import { hashPassword, createToken, verifyToken } from './authService.ts';
import { parseAndValidateVideoUrl } from '../utils/videoUrlParser.ts';

test('Creators Flow: Registration and Authentication with Role enforcement', async () => {
  const authRepo = getAuthRepository();

  // Create standard user
  const user = await authRepo.createUser({
    email: 'viajero.trujillo@gmail.com',
    passwordHash: hashPassword('MiClaveSegura2026'),
    name: 'Rosa Meléndez',
    role: 'USER',
  });

  assert.equal(user.role, 'USER');
  assert.equal(user.email, 'viajero.trujillo@gmail.com');

  const userToken = createToken(user);
  const userPayload = verifyToken(userToken);
  assert.equal(userPayload?.role, 'USER');

  // Create admin user
  const admin = await authRepo.createUser({
    email: 'admin.turismo@libertadgo.pe',
    passwordHash: hashPassword('AdminClaveMaster2026!'),
    name: 'Moderador Principal',
    role: 'ADMIN',
  });

  assert.equal(admin.role, 'ADMIN');
  const adminToken = createToken(admin);
  const adminPayload = verifyToken(adminToken);
  assert.equal(adminPayload?.role, 'ADMIN');
});

test('Creators Flow: Video Submission, URL parsing, Duplicate prevention and Place linking', async () => {
  const authRepo = getAuthRepository();
  const creatorsRepo = getCreatorsRepository();

  const creatorUser = await authRepo.createUser({
    email: 'creator.chanchan@gmail.com',
    passwordHash: hashPassword('ChanChan2026!'),
    name: 'Guía Arqueológico',
    role: 'USER',
  });

  const parsed = parseAndValidateVideoUrl('https://www.tiktok.com/@arqueologianorte/video/7391827391827391827');
  assert.equal(parsed.isValid, true);
  assert.equal(parsed.data?.platform, 'tiktok');

  // 1. Submit video linked to Chan Chan (place_chan_chan)
  const submission = await creatorsRepo.createSubmission(
    {
      userId: creatorUser.id,
      platform: parsed.data!.platform,
      externalVideoId: parsed.data!.externalVideoId,
      videoUrl: parsed.data!.canonicalUrl,
      embedUrl: parsed.data!.embedUrl,
      thumbnailUrl: null, // explicitly null
      title: 'Recorriendo los frisos milenarios de Chan Chan',
      description: 'Una visita imperdible por el conjunto amurallado Nik An.',
      contentType: 'PLACE',
      category: 'arqueologia',
      localityId: 'trujillo',
    },
    ['place_chan_chan'],
    'place_chan_chan'
  );

  assert.equal(submission.status, 'PENDING');
  assert.equal(submission.thumbnailUrl, null);
  assert.equal(submission.internalViewsCount, 0);
  assert.equal(submission.internalSavesCount, 0);

  // 2. Prevent duplicate submission with same platform and externalVideoId
  const duplicate = await creatorsRepo.findSubmissionByPlatformAndExternalId(
    parsed.data!.platform,
    parsed.data!.externalVideoId
  );
  assert.notEqual(duplicate, null);
  assert.equal(duplicate?.id, submission.id);

  // 3. Verify place association
  const linkedPlaces = await creatorsRepo.getPlacesForVideo(submission.id);
  assert.equal(linkedPlaces.length, 1);
  assert.equal(linkedPlaces[0].id, 'place_chan_chan');

  // 4. Before approval, it should NOT appear in approved feed for that place
  const approvedBefore = await creatorsRepo.getVideosForPlace('place_chan_chan');
  assert.equal(approvedBefore.length, 0);

  // 5. Admin Moderation: Approve submission
  const approved = await creatorsRepo.updateSubmissionStatus(
    submission.id,
    'APPROVED',
    'Excelente contenido verificado en sitio arqueológico',
    'usr_admin_test'
  );
  assert.equal(approved?.status, 'APPROVED');

  // 6. Record audit log
  const log = await creatorsRepo.addModerationLog({
    videoId: submission.id,
    adminUserId: 'usr_admin_test',
    adminName: 'Supervisor MINCETUR',
    previousStatus: 'PENDING',
    newStatus: 'APPROVED',
    reason: 'Cumple con directrices turísticas de La Libertad',
    internalNotes: 'Video de alta calidad educativa',
  });
  assert.equal(log.newStatus, 'APPROVED');

  // 7. Now it MUST appear in approved feed and place directory query
  const approvedAfter = await creatorsRepo.getVideosForPlace('place_chan_chan');
  assert.equal(approvedAfter.length, 1);
  assert.equal(approvedAfter[0].id, submission.id);

  // 8. Test metrics separation: internal views and saves
  await creatorsRepo.incrementInternalViews(submission.id);
  const updatedView = await creatorsRepo.findSubmissionById(submission.id);
  assert.equal(updatedView?.internalViewsCount, 1);

  const saveRes = await creatorsRepo.toggleSaveVideo(creatorUser.id, submission.id);
  assert.equal(saveRes.saved, true);
  const updatedSave = await creatorsRepo.findSubmissionById(submission.id);
  assert.equal(updatedSave?.internalSavesCount, 1);

  // 9. Verify listApprovedVideos returns enriched creator info and associated places
  await creatorsRepo.saveCreatorProfile({
    userId: creatorUser.id,
    handle: 'arqueologianorte',
    displayName: 'Arqueología del Norte',
    bio: 'Difundiendo el patrimonio liberteño',
    avatarUrl: 'https://example.com/avatar.jpg',
    primaryPlatform: 'tiktok',
    tiktokUrl: 'https://www.tiktok.com/@arqueologianorte',
    instagramUrl: null,
    youtubeUrl: null,
    isPublic: true,
  });

  const listRes = await creatorsRepo.listApprovedVideos({ localityId: 'trujillo' });
  assert.equal(listRes.total >= 1, true);
  const found = listRes.videos.find((v) => v.id === submission.id);
  assert.notEqual(found, undefined);
  assert.equal(found?.creatorHandle, 'arqueologianorte');
  assert.equal(found?.creatorDisplayName, 'Arqueología del Norte');
  assert.equal(found?.userName, 'Guía Arqueológico');
  assert.equal(found?.places.length, 1);
  assert.equal(found?.places[0].id, 'place_chan_chan');
});
