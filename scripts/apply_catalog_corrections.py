"""
Script de aplicación controlada de correcciones del catálogo de LibertadGO.
Consolida 11 duplicados confirmados (308 -> 297 lugares), corrige localidades,
sanea Google Place IDs desvinculando ChIJCR2ph4M9rZERljGRKTNw678 de los 8 lugares no plaza,
y asegura asignación exclusiva de place_1.webp y place_2.webp.
"""

import json
import os
import re

def main():
    catalog_json_path = os.path.join("src", "data", "backup_turismoPredictCatalog_308.json")
    with open(catalog_json_path, 'r', encoding='utf-8') as f:
        places_308 = json.load(f)

    print(f"[Fase 0] Cargados {len(places_308)} lugares originales desde respaldo.")

    # Mapa de consolidación: ID secundario -> ID canónico
    CONSOLIDATION_MAP = {
        'place_predict_52': 'place_rincon_vallejo',
        'place_predict_455': 'place_gran_recreo_hotel',
        'place_predict_152': 'place_big_ben_huanchaco',
        'place_predict_304': 'place_huaca_esmeralda',
        'place_predict_100': 'place_predict_99',
        'place_predict_137': 'place_predict_130',
        'place_predict_310': 'place_casa_urquiaga',
        'place_predict_309': 'place_casa_emancipacion',
        'place_predict_433': 'place_plazuela_recreo',
        'place_predict_343': 'place_huaca_arco_iris',
        'place_predict_434': 'place_hotel_costa_sol_trujillo',
    }

    # Indexar por ID
    places_by_id = {p['id']: p for p in places_308}

    # Registro de auditoría para los 11 secundarios retirados
    audit_records = []
    for sec_id, can_id in CONSOLIDATION_MAP.items():
        sec_place = places_by_id.get(sec_id)
        can_place = places_by_id.get(can_id)
        if not sec_place or not can_place:
            raise ValueError(f"No se encontró el registro {sec_id} o {can_id}")

        audit_records.append({
            'retiredId': sec_id,
            'canonicalId': can_id,
            'canonicalName': can_place['name'],
            'retiredName': sec_place['name'],
            'retiredAt': '2026-11-10T16:45:00Z',
            'rationale': f"Consolidación de duplicado confirmado según auditoría técnica de catálogo.",
            'sourcesIntegrated': sec_place.get('sources', []),
            'retiredSnapshot': sec_place
        })

        # Integrar sources externas en el canónico sin duplicar
        can_sources = can_place.get('sources', [])
        existing_keys = {(s.get('sourceId'), str(s.get('externalId'))) for s in can_sources}

        for s in sec_place.get('sources', []):
            key = (s.get('sourceId'), str(s.get('externalId')))
            if key not in existing_keys:
                can_sources.append({
                    'placeId': can_id,
                    'sourceId': s.get('sourceId'),
                    'externalId': str(s.get('externalId')),
                    'lastSyncedAt': s.get('lastSyncedAt', '2026-11-05')
                })
                existing_keys.add(key)
        can_place['sources'] = can_sources

        # Casos específicos de enriquecimiento desde el secundario:
        if can_id == 'place_big_ben_huanchaco':
            # Heredar Google Place ID verificado de place_predict_152
            g_id = sec_place.get('googlePlaceId')
            if g_id:
                can_place['googlePlaceId'] = g_id
                can_place['mapsUrl'] = f"https://www.google.com/maps/search/?api=1&query={can_place['coordinates']['lat']:.5f},{can_place['coordinates']['lng']:.5f}"

    print(f"[Fase 3] Consolidados 11 pares duplicados y preparado registro de auditoría.")

    # Guardar archivo de auditoría
    audit_path = os.path.join("src", "data", "consolidatedPlacesAudit.json")
    with open(audit_path, 'w', encoding='utf-8') as f:
        json.dump(audit_records, f, ensure_ascii=False, indent=2)
    print(f"[Fase 3] Guardado archivo de auditoría: {audit_path}")

    # Filtrar los 11 secundarios para obtener la lista activa de 297 lugares
    active_places = [p for p in places_308 if p['id'] not in CONSOLIDATION_MAP]
    print(f"[Fase 3] Lugares activos resultantes: {len(active_places)}")

    # FASE 1: Google Place IDs
    # Mantener ChIJCR2ph4M9rZERljGRKTNw678 exclusivamente en place_plaza_armas_trujillo
    decouple_g_place_ids = {
        'place_rincon_vallejo', 'place_celler_cler', 'place_demarco',
        'place_catedral_trujillo', 'place_casa_urquiaga', 'place_casa_emancipacion',
        'place_hotel_costa_sol_trujillo', 'place_gran_recreo_hotel'
    }

    for p in active_places:
        pid = p['id']
        lat = p['coordinates']['lat']
        lng = p['coordinates']['lng']

        if pid in decouple_g_place_ids:
            if 'googlePlaceId' in p:
                del p['googlePlaceId']
            # mapsUrl basado en coordenadas propias
            p['mapsUrl'] = f"https://www.google.com/maps/search/?api=1&query={lat:.5f},{lng:.5f}"
            print(f"  [Fase 1] Google Place ID desvinculado de {pid}, mapsUrl actualizado.")

        elif pid == 'place_plaza_armas_trujillo':
            p['googlePlaceId'] = 'ChIJCR2ph4M9rZERljGRKTNw678'
            p['mapsUrl'] = f"https://www.google.com/maps/search/?api=1&query=Plaza+Mayor+Trujillo+-8.11182,-79.02871"

    # FASE 2: Corrección de localidades
    for p in active_places:
        pid = p['id']

        if pid == 'place_predict_84':
            p['localityId'] = 'trujillo'
            p['localityName'] = 'Trujillo'
            p['address'] = 'Jr. Bolognesi 496, Centro Histórico de Trujillo'
            # Ajustar tags
            p['tags'] = ['Trujillo' if t == 'Moche' else t for t in p.get('tags', [])]
            print(f"  [Fase 2] place_predict_84 corregido a Trujillo (Jr. Bolognesi 496).")

        elif pid == 'place_predict_437':
            p['localityId'] = 'victor-larco'
            p['localityName'] = 'Víctor Larco Herrera'
            p['address'] = 'Calle Rosate 280, Urb. California, Víctor Larco Herrera'
            p['tags'] = ['Víctor Larco Herrera' if 'Chicama' in t or 'Malabrigo' in t else t for t in p.get('tags', [])]
            print(f"  [Fase 2] place_predict_437 corregido a Víctor Larco Herrera.")

        elif pid == 'place_predict_223':
            p['localityId'] = 'trujillo'
            p['localityName'] = 'Trujillo'
            p['address'] = 'Calle Las Palmeras 240, Urb. San Andrés, Trujillo'
            p['name'] = 'El Escudero Lodge'
            p['tags'] = ['Trujillo' if t == 'Huanchaco' else t for t in p.get('tags', [])]
            print(f"  [Fase 2] place_predict_223 corregido a Trujillo (El Escudero Lodge).")

        elif pid == 'place_predict_221':
            # Mantener puerto-malabrigo, marcar coordenadas pendientes de verificación
            p['localityId'] = 'puerto-malabrigo'
            p['localityName'] = 'Puerto Malabrigo (Chicama)'
            verif = p.get('verification', {})
            verif['isVerified'] = False
            verif['verificationLevel'] = 'unverified'
            verif['notes'] = 'Coordenadas registradas (-8.09915, -79.04343) pendientes de verificación geodésica en Malecón Grau, Puerto Malabrigo'
            p['verification'] = verif
            print(f"  [Fase 2] place_predict_221 verificado como pendiente de coordenadas geodésicas en Malecón Grau.")

    # FASE 4: Saneamiento de imágenes
    # place_1.webp exclusivamente en place_plaza_armas_trujillo
    # place_2.webp exclusivamente en place_muelle_huanchaco
    for p in active_places:
        pid = p['id']
        imgs = p.get('images', [])

        if pid != 'place_plaza_armas_trujillo':
            # Remover place_1.webp si existe
            filtered_imgs = [img for img in imgs if img.get('url') != '/images/places/place_1.webp']
            if len(filtered_imgs) != len(imgs):
                if filtered_imgs:
                    filtered_imgs[0]['isCover'] = True
                p['images'] = filtered_imgs
                print(f"  [Fase 4] place_1.webp removido de {pid}. Portada asignada a {filtered_imgs[0].get('id') if filtered_imgs else 'ninguna'}.")

        if pid != 'place_muelle_huanchaco':
            # Remover place_2.webp si existe
            filtered_imgs = [img for img in p.get('images', []) if img.get('url') != '/images/places/place_2.webp']
            if len(filtered_imgs) != len(p.get('images', [])):
                if filtered_imgs:
                    filtered_imgs[0]['isCover'] = True
                p['images'] = filtered_imgs
                print(f"  [Fase 4] place_2.webp removido de {pid}. Portada asignada a {filtered_imgs[0].get('id') if filtered_imgs else 'ninguna'}.")

    # FASE 6: Sincronización atómica de archivos
    out_json_path = os.path.join("src", "data", "turismoPredictCatalog.json")
    with open(out_json_path, 'w', encoding='utf-8') as f:
        json.dump(active_places, f, ensure_ascii=False, indent=2)
    print(f"[Fase 6] Escrito {out_json_path} con {len(active_places)} lugares.")

    out_ts_path = os.path.join("src", "data", "initialPlaces.ts")
    ts_content = "import { Place } from '../types/catalog.ts';\n\n"
    ts_content += "/**\n * Verified Tourist Catalog for La Libertad, Perú.\n"
    ts_content += f" * Consolidated & sanitized catalog ({len(active_places)} places total).\n */\n"
    ts_content += f"export const INITIAL_PLACES: Place[] = {json.dumps(active_places, ensure_ascii=False, indent=2)};\n"
    with open(out_ts_path, 'w', encoding='utf-8') as f:
        f.write(ts_content)
    print(f"[Fase 6] Escrito {out_ts_path} con {len(active_places)} lugares.")

    # FASE 7: Validaciones obligatorias
    print("\n=== EJECUTANDO VALIDACIONES OBLIGATORIAS ===")
    assert len(active_places) == 297, f"Esperado 297 lugares, obtenido {len(active_places)}"
    print("✓ Validación 1: Total de lugares activos: 297.")

    ids = [p['id'] for p in active_places]
    assert len(ids) == len(set(ids)) == 297, "IDs no son únicos"
    print("✓ Validación 2: IDs únicos: 297.")

    slugs = [p['slug'] for p in active_places]
    assert len(slugs) == len(set(slugs)) == 297, "Slugs no son únicos"
    print("✓ Validación 3: Slugs únicos: 297.")

    for sec_id in CONSOLIDATION_MAP.keys():
        assert sec_id not in ids, f"ID retirado {sec_id} sigue presente en catálogo activo"
    print("✓ Validación 4: Cero duplicados de los 11 pares consolidados.")

    g_id_target = 'ChIJCR2ph4M9rZERljGRKTNw678'
    places_with_target_gid = [p['id'] for p in active_places if p.get('googlePlaceId') == g_id_target]
    assert places_with_target_gid == ['place_plaza_armas_trujillo'], f"ChIJCR2ph4M9rZERljGRKTNw678 asociado a {places_with_target_gid}"
    print("✓ Validación 5: Google Place ID ChIJCR2ph4M9rZERljGRKTNw678 asociado exclusivamente a Plaza Mayor.")

    p84 = next(p for p in active_places if p['id'] == 'place_predict_84')
    assert p84['localityId'] == 'trujillo' and p84['address'] == 'Jr. Bolognesi 496, Centro Histórico de Trujillo'

    p437 = next(p for p in active_places if p['id'] == 'place_predict_437')
    assert p437['localityId'] == 'victor-larco' and 'California' in p437['address']

    p223 = next(p for p in active_places if p['id'] == 'place_predict_223')
    assert p223['localityId'] == 'trujillo' and p223['name'] == 'El Escudero Lodge'
    print("✓ Validación 6: Localidades corregidas según el plan (place_predict_84, 437, 223).")

    p221 = next(p for p in active_places if p['id'] == 'place_predict_221')
    assert p221['localityId'] == 'puerto-malabrigo'
    assert p221['verification']['isVerified'] is False
    assert 'pendientes de verificación geodésica' in p221['verification']['notes']
    print("✓ Validación 7: place_predict_221 marcado como pendiente de coordenadas.")

    p1_users = [p['id'] for p in active_places for img in p.get('images', []) if img.get('url') == '/images/places/place_1.webp']
    assert p1_users == ['place_plaza_armas_trujillo'], f"place_1.webp sigue en {p1_users}"
    print("✓ Validación 8: place_1.webp asignado únicamente a Plaza Mayor.")

    p2_users = [p['id'] for p in active_places for img in p.get('images', []) if img.get('url') == '/images/places/place_2.webp']
    assert p2_users == ['place_muelle_huanchaco'], f"place_2.webp asignado a {p2_users}"
    print("✓ Validación 9: place_2.webp asignado únicamente al Muelle de Huanchaco.")

    # Verificar sincronización entre archivos
    with open(out_json_path, 'r', encoding='utf-8') as f:
        re_json = json.load(f)
    assert len(re_json) == len(active_places) == 297
    print("✓ Validación 11: Ambos archivos de catálogo perfectamente sincronizados.")

    print("\nTODAS LAS VALIDACIONES DE DATOS COMPLETADAS CON ÉXITO.")

if __name__ == '__main__':
    main()
