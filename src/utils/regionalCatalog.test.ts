import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_PLACES } from '../data/initialPlaces.ts';
import {
  matchesCategory,
  matchesSearchQuery,
  matchesLocality,
  filterCatalogPlaces,
  LOCALITY_FILTER_OPTIONS,
} from './filterUtils.ts';
import { addPlaceToDay } from './itineraryUtils.ts';
import { TripActivity } from '../types/catalog.ts';

test('1 & 2. Catálogo regional completo se inicializa y mantiene en 297 lugares', () => {
  assert.equal(INITIAL_PLACES.length, 297, 'El catálogo regional base debe contener exactamente 297 lugares');
  const clone = [...INITIAL_PLACES];
  assert.equal(clone.length, 297);
});

test('3. En la sección Explorar con "todas", el usuario tiene acceso a los 297 lugares', () => {
  const allPlaces = filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'todas');
  assert.equal(allPlaces.length, 297, 'El filtro con localidad "todas" debe devolver 297 lugares');
});

test('4. El catálogo contiene lugares de todas las 10 localidades de La Libertad', () => {
  const localitiesFound = new Set(INITIAL_PLACES.map((p) => p.localityId.toLowerCase()));
  const expectedLocalities = [
    'trujillo',
    'huanchaco',
    'la-esperanza',
    'victor-larco',
    'huamachuco',
    'moche',
    'puerto-malabrigo',
    'pacasmayo',
    'magdalena-cao',
    'cascas',
  ];

  for (const expected of expectedLocalities) {
    assert.ok(localitiesFound.has(expected), `Debe contener lugares para la localidad: ${expected}`);
  }
  assert.equal(localitiesFound.size, 10, 'Deben existir exactamente 10 localidades');
});

test('5. Si el usuario filtra por Trujillo, ve exactamente 153 lugares', () => {
  const trujilloPlaces = filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'trujillo');
  assert.equal(trujilloPlaces.length, 153, 'Trujillo debe tener exactamente 153 lugares');
});

test('6. Si el usuario filtra por Huanchaco, ve exactamente 53 lugares', () => {
  const huanchacoPlaces = filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'huanchaco');
  assert.equal(huanchacoPlaces.length, 53, 'Huanchaco debe tener exactamente 53 lugares');
});

test('7. Si el usuario filtra por Moche, ve exactamente 7 lugares', () => {
  const mochePlaces = filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'moche');
  assert.equal(mochePlaces.length, 7, 'Moche debe tener exactamente 7 lugares');
});

test('Otras localidades tienen conteos exactos según auditoría', () => {
  assert.equal(filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'la-esperanza').length, 30);
  assert.equal(filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'victor-larco').length, 27);
  assert.equal(filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'huamachuco').length, 13);
  assert.equal(filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'puerto-malabrigo').length, 6);
  assert.equal(filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'pacasmayo').length, 4);
  assert.equal(filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'magdalena-cao').length, 2);
  assert.equal(filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'cascas').length, 2);
});

test('8. Si selecciona "Toda La Libertad", vuelve a ver los 297 lugares', () => {
  // Simular transición Trujillo -> Toda La Libertad
  const trujilloOnly = filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'trujillo');
  assert.equal(trujilloOnly.length, 153);

  const backToAll = filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'todas');
  assert.equal(backToAll.length, 297, 'Al regresar a Toda La Libertad se obtienen nuevamente los 297 lugares');
});

test('9. El catálogo global no se muta al aplicar filtros de localidad', () => {
  const initialLength = INITIAL_PLACES.length;
  // Aplicar múltiples filtros
  filterCatalogPlaces(INITIAL_PLACES, 'todas', '', 'moche');
  filterCatalogPlaces(INITIAL_PLACES, 'arqueologia', '', 'trujillo');
  filterCatalogPlaces(INITIAL_PLACES, 'playas', '', 'huanchaco');

  assert.equal(INITIAL_PLACES.length, initialLength, 'El array INITIAL_PLACES debe permanecer con 297 elementos');
  assert.equal(INITIAL_PLACES.length, 297);
});

test('10. El filtro por categoría funciona sobre el subconjunto de localidad activo', () => {
  // Arqueología en Moche (ej. Huaca de la Luna, Huaca del Sol, Museo Huacas de Moche)
  const mocheArqueo = filterCatalogPlaces(INITIAL_PLACES, 'arqueologia', '', 'moche');
  assert.ok(mocheArqueo.length > 0, 'Debe haber lugares de arqueología en Moche');
  mocheArqueo.forEach((p) => {
    assert.equal(p.localityId, 'moche');
    assert.equal(p.category, 'arqueologia');
  });

  // Playas en Huanchaco
  const huanchacoPlayas = filterCatalogPlaces(INITIAL_PLACES, 'playas', '', 'huanchaco');
  assert.ok(huanchacoPlayas.length > 0, 'Debe haber playas en Huanchaco');
  huanchacoPlayas.forEach((p) => {
    assert.equal(p.localityId, 'huanchaco');
    assert.equal(p.category, 'playas');
  });
});

test('11. La búsqueda por texto funciona sobre el catálogo completo o filtrado', () => {
  // Búsqueda en todo el catálogo regional
  const chanChan = filterCatalogPlaces(INITIAL_PLACES, 'todas', 'Chan Chan', 'todas');
  assert.ok(chanChan.length > 0, 'Debe encontrar Chan Chan en Toda La Libertad');

  // Búsqueda en Huanchaco
  const cevicheHuanchaco = filterCatalogPlaces(INITIAL_PLACES, 'todas', 'ceviche', 'huanchaco');
  assert.ok(cevicheHuanchaco.length > 0, 'Debe encontrar ceviche en Huanchaco');
  cevicheHuanchaco.forEach((p) => {
    assert.equal(p.localityId, 'huanchaco');
  });

  // Búsqueda en Huamachuco (Marcahuamachuco)
  const marcaHuamachuco = filterCatalogPlaces(INITIAL_PLACES, 'todas', 'Marcahuamachuco', 'huamachuco');
  assert.ok(marcaHuamachuco.length > 0, 'Debe encontrar Marcahuamachuco en Huamachuco');
  assert.equal(marcaHuamachuco[0].localityId, 'huamachuco');
});

test('12. Las actividades asignadas a los días conservan sus datos e imágenes al cruzar localidades', () => {
  const trujilloPlace = INITIAL_PLACES.find((p) => p.localityId === 'trujillo')!;
  const huanchacoPlace = INITIAL_PLACES.find((p) => p.localityId === 'huanchaco')!;
  const mochePlace = INITIAL_PLACES.find((p) => p.localityId === 'moche')!;

  assert.ok(trujilloPlace && huanchacoPlace && mochePlace);

  // Viaje con base en Trujillo que añade actividades de Huanchaco (Día 1) y Moche (Día 2)
  let activities: TripActivity[] = [];
  const res1 = addPlaceToDay(activities, 'trip-1', huanchacoPlace, 1);
  assert.ok(res1.added);
  activities = res1.activities;

  const res2 = addPlaceToDay(activities, 'trip-1', mochePlace, 2);
  assert.ok(res2.added);
  activities = res2.activities;

  const res3 = addPlaceToDay(activities, 'trip-1', trujilloPlace, 1);
  assert.ok(res3.added);
  activities = res3.activities;

  assert.equal(activities.length, 3);
  assert.equal(activities[0].placeId, huanchacoPlace.id);
  assert.equal(activities[0].dayNumber, 1);
  assert.equal(activities[0].place?.localityId, 'huanchaco');
  assert.ok(activities[0].place?.images && activities[0].place.images.length > 0);

  assert.equal(activities[1].placeId, mochePlace.id);
  assert.equal(activities[1].dayNumber, 2);
  assert.equal(activities[1].place?.localityId, 'moche');

  assert.equal(activities[2].placeId, trujilloPlace.id);
  assert.equal(activities[2].dayNumber, 1);
  assert.equal(activities[2].place?.localityId, 'trujillo');
});
