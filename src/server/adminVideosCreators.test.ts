import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthRepository, getCreatorsRepository } from './repositories/index.ts';
import { hashPassword } from './authService.ts';
import { parseAndValidateVideoUrl } from '../utils/videoUrlParser.ts';

test('Admin Video Management: Direct Registration, Place Linking, and Updates', async () => {
  const authRepo = getAuthRepository();
  const creatorsRepo = getCreatorsRepository();

  // Create admin user
  const admin = await authRepo.createUser({
    email: 'admin.video.test@libertadgo.pe',
    passwordHash: hashPassword('AdminPass2026!'),
    name: 'Admin Gestor',
    role: 'ADMIN',
  });

  const parsedUrl = parseAndValidateVideoUrl('https://www.tiktok.com/@descubrelalibertad/video/7483920192837461928');
  assert.equal(parsedUrl.isValid, true);

  // 1. Register video as APPROVED immediately with multiple linked places
  const createdVideo = await creatorsRepo.createSubmission(
    {
      userId: admin.id,
      creatorProfileId: null, // External video without registered profile
      platform: parsedUrl.data!.platform,
      externalVideoId: parsedUrl.data!.externalVideoId,
      videoUrl: parsedUrl.data!.canonicalUrl,
      embedUrl: parsedUrl.data!.embedUrl,
      thumbnailUrl: 'https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?auto=format&fit=crop&w=800&q=80',
      title: 'Chan Chan y Huaca del Sol: Maravillas Moche y Chimú',
      description: 'Recorrido audiovisual por las ciudadelas prehispánicas de barro en Trujillo',
      contentType: 'ROUTE',
      category: 'arqueologia',
      localityId: 'trujillo',
      status: 'APPROVED',
    },
    ['place_chan_chan', 'place_huacas_sol_luna'],
    'place_chan_chan'
  );

  assert.equal(createdVideo.status, 'APPROVED');
  assert.equal(createdVideo.platform, 'tiktok');
  assert.equal(createdVideo.category, 'arqueologia');

  // Verify places linked
  const places = await creatorsRepo.getPlacesForVideo(createdVideo.id);
  assert.equal(places.length, 2);
  assert.equal(places[0].id, 'place_chan_chan');

  // 2. Update video metadata and places via updateSubmission
  const updatedVideo = await creatorsRepo.updateSubmission(
    createdVideo.id,
    {
      title: 'Chan Chan y Huaca del Sol: Maravillas de La Libertad (Actualizado)',
      description: 'Guía completa actualizada con horarios y accesos para visitantes',
      category: 'arqueologia',
      localityId: 'trujillo',
      status: 'APPROVED',
    },
    ['place_chan_chan', 'place_huacas_sol_luna', 'place_el_brujo'],
    'place_chan_chan'
  );

  assert.equal(updatedVideo?.title, 'Chan Chan y Huaca del Sol: Maravillas de La Libertad (Actualizado)');
  const updatedPlaces = await creatorsRepo.getPlacesForVideo(createdVideo.id);
  assert.equal(updatedPlaces.length, 3);
  assert.equal(updatedPlaces.some((p) => p.id === 'place_el_brujo'), true);
});

test('Admin Creator Management: Profile Creation, Verification, and User Association', async () => {
  const authRepo = getAuthRepository();
  const creatorsRepo = getCreatorsRepository();

  // Create user to link to creator profile
  const creatorUser = await authRepo.createUser({
    email: 'contacto@culturaviva.pe',
    passwordHash: hashPassword('CulturaViva2026!'),
    name: 'Carlos Arana - Cronista',
    role: 'USER',
  });

  // Verify listUsers works
  const users = await authRepo.listUsers();
  assert.equal(users.length >= 1, true);
  assert.equal(users.some((u) => u.id === creatorUser.id), true);

  // 1. Create creator profile
  const profile = await creatorsRepo.saveCreatorProfile({
    userId: creatorUser.id,
    handle: 'culturavivalibertad',
    displayName: 'Cultura Viva La Libertad',
    bio: 'Documentando tradiciones, gastronomía y patrimonio de las 12 provincias',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    primaryPlatform: 'tiktok',
    tiktokUrl: 'https://www.tiktok.com/@culturavivalibertad',
    instagramUrl: 'https://instagram.com/culturavivalibertad',
    youtubeUrl: 'https://youtube.com/@culturavivalibertad',
    isPublic: true,
    isVerified: true,
  });

  assert.equal(profile.handle, 'culturavivalibertad');
  assert.equal(profile.isVerified, true);
  assert.equal(profile.primaryPlatform, 'tiktok');

  // 2. Verify listAllCreators returns the created profile
  const allCreators = await creatorsRepo.listAllCreators();
  assert.equal(allCreators.length >= 1, true);
  const foundCreator = allCreators.find((c) => c.handle === 'culturavivalibertad');
  assert.notEqual(foundCreator, undefined);
  assert.equal(foundCreator?.displayName, 'Cultura Viva La Libertad');
  assert.equal(foundCreator?.isVerified, true);
});
