/**
 * PostgreSQL / Neon Implementation of IPlaceRepository
 * Uses connection pooling, parameterized queries, and ACID transactions.
 * Strict fail-fast behavior: All writes and deduplications are atomic.
 */

import { Pool, PoolClient } from 'pg';
import { IPlaceRepository } from './placeRepository.ts';
import { Place, PlaceCategory, PlaceVerification, PlaceSource, PlaceImage, PlaceOpeningHours } from '../../types/catalog.ts';
import {
  AdminPlaceRecord,
  PlaceStatus,
  PlaceAuditEntry,
  PlaceAdminFilters,
  DuplicatePair,
  AdminDashboardMetrics,
} from '../../types/adminCatalog.ts';
import { INITIAL_PLACES } from '../../data/initialPlaces.ts';
import { isWithinLaLibertad } from '../../utils/geoBoundary.ts';
import { LA_LIBERTAD_LOCALITIES } from '../../types/geo.ts';
import crypto from 'crypto';

// Distance calculation using Haversine formula (meters)
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Normalized string similarity (Levenshtein, token Jaccard, and Dice coefficient hybrid)
function calculateStringSimilarity(str1: string, str2: string): number {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();

  const s1 = clean(str1);
  const s2 = clean(str2);

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = Math.max(s1.length, s2.length);
    const shorter = Math.min(s1.length, s2.length);
    return Math.max(0.8, shorter / longer);
  }

  const words1 = new Set(s1.split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter((w) => w.length > 2));

  let wordMatches = 0;
  words1.forEach((w) => {
    if (words2.has(w)) wordMatches++;
  });
  const wordUnion = new Set([...words1, ...words2]).size;
  const jaccard = wordUnion > 0 ? wordMatches / wordUnion : 0;

  const getBigrams = (str: string) => {
    const s = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      s.add(str.slice(i, i + 2));
    }
    return s;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);
  let intersection = 0;
  bg1.forEach((b) => {
    if (bg2.has(b)) intersection++;
  });

  const dice = (2.0 * intersection) / (bg1.size + bg2.size || 1);
  return Math.max(jaccard, dice);
}

export class PostgresPlaceRepository implements IPlaceRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async testConnection(): Promise<void> {
    const res = await this.pool.query('SELECT 1 as ping');
    if (!res || !res.rows || res.rows.length === 0) {
      throw new Error('Database ping query returned no results.');
    }
  }

  /**
   * Idempotent seed of the 297 verified places of La Libertad.
   * Uses ON CONFLICT (id) DO NOTHING so existing administrator edits are preserved.
   */
  async seedInitialPlaces(): Promise<{ inserted: number; total: number }> {
    const client = await this.pool.connect();
    let insertedCount = 0;

    try {
      await client.query('BEGIN');

      for (const p of INITIAL_PLACES) {
        if (!isWithinLaLibertad(p.coordinates)) continue;

        const checkRes = await client.query('SELECT id FROM places WHERE id = $1', [p.id]);
        if (checkRes.rows.length > 0) continue;

        await client.query(
          `INSERT INTO places (
            id, slug, name, category, subcategory, locality_id, locality_name,
            address, latitude, longitude, geohash, description, short_description,
            phone, email, website, maps_url, google_place_id, price_level,
            rating, reviews_count, recommended_duration_minutes, tags,
            safety_data, prediction_data, status, verification_level,
            is_verified, verified_by, verified_at, verification_notes,
            created_by, updated_by, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19,
            $20, $21, $22, $23,
            $24, $25, $26, $27,
            $28, $29, $30, $31,
            $32, $33, NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING`,
          [
            p.id,
            p.slug,
            p.name,
            p.category,
            p.subcategory || null,
            p.localityId,
            p.localityName,
            p.address,
            p.coordinates.lat,
            p.coordinates.lng,
            p.geohash || null,
            p.fullDescription || null,
            p.shortDescription,
            p.phone || null,
            p.email || null,
            p.website || null,
            p.mapsUrl || null,
            p.googlePlaceId || null,
            p.priceLevel || 2,
            p.rating || 4.5,
            p.reviewsCount || 0,
            p.recommendedDurationMinutes || 60,
            p.tags || [],
            p.safetyReport ? JSON.stringify(p.safetyReport) : null,
            p.predictionScore ? JSON.stringify(p.predictionScore) : null,
            'PUBLISHED',
            p.verification?.verificationLevel || 'partner_verified',
            Boolean(p.verification?.isVerified),
            p.verification?.verifiedBy || null,
            p.verification?.verifiedAt || null,
            p.verification?.notes || null,
            null, // admin_user_id null for system seed
            null,
          ]
        );

        // Images
        if (Array.isArray(p.images)) {
          for (let i = 0; i < p.images.length; i++) {
            const img = p.images[i];
            await client.query(
              `INSERT INTO place_images (
                id, place_id, url, caption, author, license, is_cover, order_index, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
              ON CONFLICT (id) DO NOTHING`,
              [
                img.id || `img_${p.id}_${i}`,
                p.id,
                img.url,
                img.caption || null,
                img.author || null,
                img.license || null,
                Boolean(img.isCover),
                i,
              ]
            );
          }
        }

        // Sources
        if (Array.isArray(p.sources)) {
          for (let i = 0; i < p.sources.length; i++) {
            const src = p.sources[i];
            await client.query(
              `INSERT INTO place_sources (
                id, place_id, source_id, external_id, raw_data_ref, last_synced_at, created_at
              ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
              ON CONFLICT DO NOTHING`,
              [
                `src_${p.id}_${i}`,
                p.id,
                src.sourceId,
                src.externalId,
                src.rawDataRef || null,
              ]
            );
          }
        }

        // Opening Hours
        if (Array.isArray(p.openingHours)) {
          for (const h of p.openingHours) {
            await client.query(
              `INSERT INTO place_opening_hours (
                id, place_id, day_of_week, open_time, close_time, is_closed
              ) VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT DO NOTHING`,
              [
                `hrs_${p.id}_${h.dayOfWeek}`,
                p.id,
                h.dayOfWeek,
                h.openTime,
                h.closeTime,
                Boolean(h.isClosed),
              ]
            );
          }
        }

        insertedCount++;
      }

      // Record seed audit log
      if (insertedCount > 0) {
        await client.query(
          `INSERT INTO place_audit_log (
            id, place_id, actor_type, admin_user_id, admin_name, action,
            previous_data, new_data, change_summary, created_at
          ) VALUES ($1, $2, 'SYSTEM', NULL, $3, $4, NULL, NULL, $5, NOW())`,
          [
            `audit_seed_${Date.now()}`,
            'all',
            'Sistema LibertadGO',
            'CREATE',
            `Catálogo inicial migrado a PostgreSQL Neon con ${insertedCount} lugares verificados de La Libertad.`,
          ]
        );
      }

      await client.query('COMMIT');

      const totalRes = await client.query('SELECT COUNT(*) as total FROM places');
      const total = parseInt(totalRes.rows[0].total, 10);

      return { inserted: insertedCount, total };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --- Helpers to map rows to domain objects ---
  private mapRowToPlace(row: any, images: PlaceImage[] = [], sources: PlaceSource[] = [], hours: PlaceOpeningHours[] = []): AdminPlaceRecord {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory || undefined,
      localityId: row.locality_id,
      localityName: row.locality_name,
      address: row.address,
      coordinates: {
        lat: parseFloat(row.latitude),
        lng: parseFloat(row.longitude),
      },
      geohash: row.geohash || '',
      shortDescription: row.short_description || '',
      fullDescription: row.description || undefined,
      phone: row.phone || undefined,
      email: row.email || undefined,
      website: row.website || undefined,
      mapsUrl: row.maps_url || undefined,
      googlePlaceId: row.google_place_id || undefined,
      priceLevel: row.price_level || 2,
      rating: row.rating ? parseFloat(row.rating) : 4.5,
      reviewsCount: row.reviews_count || 0,
      images,
      openingHours: hours,
      verification: {
        isVerified: Boolean(row.is_verified),
        verificationLevel: row.verification_level || 'partner_verified',
        verifiedBy: row.verified_by || undefined,
        verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : undefined,
        notes: row.verification_notes || undefined,
      },
      sources,
      tags: row.tags || [],
      recommendedDurationMinutes: row.recommended_duration_minutes || 60,
      safetyScore: row.safety_data?.score || 85,
      safetyReport: row.safety_data || undefined,
      predictionScore: row.prediction_data || undefined,
      status: row.status as PlaceStatus,
      createdBy: row.created_by || undefined,
      updatedBy: row.updated_by || undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  async listPlaces(filters?: PlaceAdminFilters): Promise<{
    places: AdminPlaceRecord[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.listPlacesAsync(filters);
  }

  async listPlacesAsync(filters?: PlaceAdminFilters): Promise<{
    places: AdminPlaceRecord[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters?.search) {
      const q = `%${filters.search.toLowerCase().trim()}%`;
      conditions.push(`(
        LOWER(name) LIKE $${idx} OR
        LOWER(address) LIKE $${idx} OR
        LOWER(locality_name) LIKE $${idx} OR
        LOWER(category) LIKE $${idx} OR
        LOWER(id) LIKE $${idx}
      )`);
      values.push(q);
      idx++;
    }

    if (filters?.status && filters.status !== 'ALL') {
      conditions.push(`status = $${idx}`);
      values.push(filters.status);
      idx++;
    }

    if (filters?.category && filters.category !== 'todas') {
      conditions.push(`category = $${idx}`);
      values.push(filters.category.toLowerCase());
      idx++;
    }

    if (filters?.localityId && filters.localityId !== 'todas') {
      conditions.push(`locality_id = $${idx}`);
      values.push(filters.localityId.toLowerCase());
      idx++;
    }

    if (filters?.isVerified !== undefined && filters.isVerified !== 'ALL') {
      conditions.push(`is_verified = $${idx}`);
      values.push(Boolean(filters.isVerified));
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM places ${whereClause}`;
    const countRes = await this.pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    const sortBy = filters?.sortBy || 'updatedAt';
    const sortOrder = filters?.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const colMap: Record<string, string> = {
      name: 'name',
      rating: 'rating',
      reviewsCount: 'reviews_count',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    const orderCol = colMap[sortBy] || 'updated_at';

    const page = Math.max(1, filters?.page || 1);
    const limit = Math.max(1, Math.min(500, filters?.limit || 20));
    const offset = (page - 1) * limit;

    const dataQuery = `
      SELECT * FROM places
      ${whereClause}
      ORDER BY ${orderCol} ${sortOrder}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    const dataRes = await this.pool.query(dataQuery, [...values, limit, offset]);

    const places: AdminPlaceRecord[] = [];
    for (const row of dataRes.rows) {
      const imgRes = await this.pool.query(
        'SELECT * FROM place_images WHERE place_id = $1 ORDER BY order_index ASC',
        [row.id]
      );
      const images: PlaceImage[] = imgRes.rows.map((img) => ({
        id: img.id,
        url: img.url,
        caption: img.caption || undefined,
        author: img.author || undefined,
        license: img.license || undefined,
        isCover: Boolean(img.is_cover),
      }));

      places.push(this.mapRowToPlace(row, images));
    }

    return {
      places,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getPlaceById(id: string): Promise<AdminPlaceRecord | null> {
    return this.getPlaceByIdAsync(id);
  }

  async getPlaceByIdAsync(id: string): Promise<AdminPlaceRecord | null> {
    const res = await this.pool.query('SELECT * FROM places WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    const imgRes = await this.pool.query(
      'SELECT * FROM place_images WHERE place_id = $1 ORDER BY order_index ASC',
      [id]
    );
    const images: PlaceImage[] = imgRes.rows.map((img) => ({
      id: img.id,
      url: img.url,
      caption: img.caption || undefined,
      author: img.author || undefined,
      license: img.license || undefined,
      isCover: Boolean(img.is_cover),
    }));

    const srcRes = await this.pool.query('SELECT * FROM place_sources WHERE place_id = $1', [id]);
    const sources: PlaceSource[] = srcRes.rows.map((s) => ({
      placeId: s.place_id,
      sourceId: s.source_id,
      externalId: s.external_id,
      rawDataRef: s.raw_data_ref || undefined,
      lastSyncedAt: s.last_synced_at ? new Date(s.last_synced_at).toISOString() : new Date().toISOString(),
    }));

    const hrsRes = await this.pool.query('SELECT * FROM place_opening_hours WHERE place_id = $1', [id]);
    const hours: PlaceOpeningHours[] = hrsRes.rows.map((h) => ({
      dayOfWeek: h.day_of_week,
      openTime: h.open_time,
      closeTime: h.close_time,
      isClosed: Boolean(h.is_closed),
    }));

    return this.mapRowToPlace(row, images, sources, hours);
  }

  async getPlaceBySlug(slug: string): Promise<AdminPlaceRecord | null> {
    return this.getPlaceBySlugAsync(slug);
  }

  async getPlaceBySlugAsync(slug: string): Promise<AdminPlaceRecord | null> {
    const res = await this.pool.query('SELECT * FROM places WHERE slug = $1', [slug]);
    if (res.rows.length === 0) return null;
    return this.getPlaceByIdAsync(res.rows[0].id);
  }

  async createPlace(
    data: Partial<AdminPlaceRecord>,
    adminUserId: string,
    adminName: string
  ): Promise<AdminPlaceRecord> {
    return this.createPlaceAsync(data, adminUserId, adminName);
  }

  async createPlaceAsync(
    data: Partial<AdminPlaceRecord>,
    adminUserId: string,
    adminName: string
  ): Promise<AdminPlaceRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const id = data.id || `place_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const baseSlug = (data.name || 'nuevo-lugar')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      let slug = baseSlug;
      let counter = 1;
      while (true) {
        const check = await client.query('SELECT id FROM places WHERE slug = $1', [slug]);
        if (check.rows.length === 0) break;
        slug = `${baseSlug}-${counter++}`;
      }

      await client.query(
        `INSERT INTO places (
          id, slug, name, category, subcategory, locality_id, locality_name,
          address, latitude, longitude, geohash, description, short_description,
          phone, email, website, maps_url, google_place_id, price_level,
          rating, reviews_count, recommended_duration_minutes, tags,
          safety_data, prediction_data, status, verification_level,
          is_verified, verified_by, verified_at, verification_notes,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23,
          $24, $25, $26, $27,
          $28, $29, $30, $31,
          $32, $33, NOW(), NOW()
        )`,
        [
          id,
          data.slug || slug,
          data.name || 'Nuevo Lugar Turístico',
          data.category || 'atractivos',
          data.subcategory || null,
          data.localityId || 'trujillo',
          data.localityName || 'Trujillo',
          data.address || 'Trujillo, La Libertad',
          data.coordinates?.lat || -8.1118,
          data.coordinates?.lng || -79.0287,
          data.geohash || null,
          data.fullDescription || null,
          data.shortDescription || '',
          data.phone || null,
          data.email || null,
          data.website || null,
          data.mapsUrl || null,
          data.googlePlaceId || null,
          data.priceLevel || 2,
          data.rating !== undefined ? data.rating : 4.5,
          data.reviewsCount || 0,
          data.recommendedDurationMinutes || 60,
          data.tags || ['turismo', 'la-libertad'],
          data.safetyReport ? JSON.stringify(data.safetyReport) : null,
          data.predictionScore ? JSON.stringify(data.predictionScore) : null,
          data.status || 'PUBLISHED',
          data.verification?.verificationLevel || 'partner_verified',
          Boolean(data.verification?.isVerified ?? true),
          adminName,
          new Date().toISOString(),
          data.verification?.notes || null,
          adminUserId.startsWith('user_') ? adminUserId : null,
          adminUserId.startsWith('user_') ? adminUserId : null,
        ]
      );

      // Images
      const images: PlaceImage[] = Array.isArray(data.images) && data.images.length > 0
        ? data.images
        : [
            {
              id: `img_${Date.now()}`,
              url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
              caption: data.name,
              isCover: true,
            },
          ];

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        await client.query(
          `INSERT INTO place_images (
            id, place_id, url, caption, author, license, is_cover, order_index, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            img.id || `img_${id}_${i}`,
            id,
            img.url,
            img.caption || null,
            img.author || null,
            img.license || null,
            Boolean(img.isCover),
            i,
          ]
        );
      }

      // Audit Log
      const isCreateSystem = !adminUserId || adminUserId === 'system' || !adminUserId.startsWith('user_');
      await client.query(
        `INSERT INTO place_audit_log (
          id, place_id, actor_type, admin_user_id, admin_name, action,
          previous_data, new_data, change_summary, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, NOW())`,
        [
          `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          id,
          isCreateSystem ? 'SYSTEM' : 'ADMIN',
          isCreateSystem ? null : adminUserId,
          adminName || (isCreateSystem ? 'Sistema LibertadGO' : 'Administrador'),
          'CREATE',
          JSON.stringify(data),
          `Creado nuevo lugar: "${data.name}" (${data.category}) con estado ${data.status || 'PUBLISHED'}.`,
        ]
      );

      await client.query('COMMIT');

      const created = await this.getPlaceByIdAsync(id);
      return created!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updatePlace(
    id: string,
    data: Partial<AdminPlaceRecord>,
    adminUserId: string,
    adminName: string,
    summary?: string
  ): Promise<AdminPlaceRecord | null> {
    return this.updatePlaceAsync(id, data, adminUserId, adminName, summary);
  }

  async updatePlaceAsync(
    id: string,
    data: Partial<AdminPlaceRecord>,
    adminUserId: string,
    adminName: string,
    summary?: string
  ): Promise<AdminPlaceRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await this.getPlaceByIdAsync(id);
      if (!existing) {
        await client.query('ROLLBACK');
        return null;
      }

      const isUpdateSystem = !adminUserId || adminUserId === 'system' || !adminUserId.startsWith('user_');
      const resolvedUserId = isUpdateSystem ? null : adminUserId;

      await client.query(
        `UPDATE places SET
          name = COALESCE($1, name),
          category = COALESCE($2, category),
          subcategory = COALESCE($3, subcategory),
          locality_id = COALESCE($4, locality_id),
          locality_name = COALESCE($5, locality_name),
          address = COALESCE($6, address),
          latitude = COALESCE($7, latitude),
          longitude = COALESCE($8, longitude),
          short_description = COALESCE($9, short_description),
          description = COALESCE($10, description),
          phone = COALESCE($11, phone),
          email = COALESCE($12, email),
          website = COALESCE($13, website),
          maps_url = COALESCE($14, maps_url),
          price_level = COALESCE($15, price_level),
          recommended_duration_minutes = COALESCE($16, recommended_duration_minutes),
          status = COALESCE($17, status),
          tags = COALESCE($18, tags),
          safety_data = COALESCE($19, safety_data),
          updated_by = $20,
          updated_at = NOW()
        WHERE id = $21`,
        [
          data.name || null,
          data.category || null,
          data.subcategory || null,
          data.localityId || null,
          data.localityName || null,
          data.address || null,
          data.coordinates?.lat || null,
          data.coordinates?.lng || null,
          data.shortDescription || null,
          data.fullDescription || null,
          data.phone || null,
          data.email || null,
          data.website || null,
          data.mapsUrl || null,
          data.priceLevel || null,
          data.recommendedDurationMinutes || null,
          data.status || null,
          data.tags || null,
          data.safetyReport ? JSON.stringify(data.safetyReport) : null,
          resolvedUserId,
          id,
        ]
      );

      // Audit log
      await client.query(
        `INSERT INTO place_audit_log (
          id, place_id, actor_type, admin_user_id, admin_name, action,
          previous_data, new_data, change_summary, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          id,
          isUpdateSystem ? 'SYSTEM' : 'ADMIN',
          resolvedUserId,
          adminName || (isUpdateSystem ? 'Sistema LibertadGO' : 'Administrador'),
          'UPDATE',
          JSON.stringify(existing),
          JSON.stringify(data),
          summary || `Actualizados datos de "${data.name || existing.name}" por ${adminName}.`,
        ]
      );

      await client.query('COMMIT');
      return await this.getPlaceByIdAsync(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateStatus(
    id: string,
    status: PlaceStatus,
    adminUserId: string,
    adminName: string,
    reason?: string
  ): Promise<AdminPlaceRecord | null> {
    return this.updateStatusAsync(id, status, adminUserId, adminName, reason);
  }

  async updateStatusAsync(
    id: string,
    status: PlaceStatus,
    adminUserId: string,
    adminName: string,
    reason?: string
  ): Promise<AdminPlaceRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await this.getPlaceByIdAsync(id);
      if (!existing) {
        await client.query('ROLLBACK');
        return null;
      }

      const isStatusSystem = !adminUserId || adminUserId === 'system' || !adminUserId.startsWith('user_');
      const resolvedUserId = isStatusSystem ? null : adminUserId;

      await client.query('UPDATE places SET status = $1, updated_by = $2, updated_at = NOW() WHERE id = $3', [
        status,
        resolvedUserId,
        id,
      ]);

      await client.query(
        `INSERT INTO place_audit_log (
          id, place_id, actor_type, admin_user_id, admin_name, action,
          previous_data, new_data, change_summary, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          id,
          isStatusSystem ? 'SYSTEM' : 'ADMIN',
          resolvedUserId,
          adminName || (isStatusSystem ? 'Sistema LibertadGO' : 'Administrador'),
          status === 'ARCHIVED' ? 'ARCHIVE' : 'STATUS_CHANGE',
          JSON.stringify({ status: existing.status }),
          JSON.stringify({ status }),
          `Cambio de estado en "${existing.name}": de ${existing.status} a ${status}.${reason ? ` Motivo: ${reason}` : ''}`,
        ]
      );

      await client.query('COMMIT');
      return await this.getPlaceByIdAsync(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async verifyPlace(
    id: string,
    isVerified: boolean,
    level: PlaceVerification['verificationLevel'],
    notes: string | undefined,
    adminUserId: string,
    adminName: string
  ): Promise<AdminPlaceRecord | null> {
    return this.verifyPlaceAsync(id, isVerified, level, notes, adminUserId, adminName);
  }

  async verifyPlaceAsync(
    id: string,
    isVerified: boolean,
    level: PlaceVerification['verificationLevel'],
    notes: string | undefined,
    adminUserId: string,
    adminName: string
  ): Promise<AdminPlaceRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await this.getPlaceByIdAsync(id);
      if (!existing) {
        await client.query('ROLLBACK');
        return null;
      }

      const isVerifySystem = !adminUserId || adminUserId === 'system' || !adminUserId.startsWith('user_');
      const resolvedUserId = isVerifySystem ? null : adminUserId;

      await client.query(
        `UPDATE places SET
          is_verified = $1,
          verification_level = $2,
          verified_by = $3,
          verified_at = NOW(),
          verification_notes = $4,
          updated_at = NOW()
        WHERE id = $5`,
        [isVerified, level, resolvedUserId, notes || null, id]
      );

      await client.query(
        `INSERT INTO place_audit_log (
          id, place_id, actor_type, admin_user_id, admin_name, action,
          previous_data, new_data, change_summary, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          id,
          isVerifySystem ? 'SYSTEM' : 'ADMIN',
          resolvedUserId,
          adminName || (isVerifySystem ? 'Sistema LibertadGO' : 'Administrador'),
          'VERIFY',
          JSON.stringify({ verification: existing.verification }),
          JSON.stringify({ isVerified, level, notes }),
          `${isVerified ? 'Verificado' : 'Desverificado'} "${existing.name}" (Nivel: ${level}).${notes ? ` Notas: ${notes}` : ''}`,
        ]
      );

      await client.query('COMMIT');
      return await this.getPlaceByIdAsync(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getAuditLogs(placeId?: string, limit: number = 50): Promise<PlaceAuditEntry[]> {
    return this.getAuditLogsAsync(placeId, limit);
  }

  async getAuditLogsAsync(placeId?: string, limit: number = 50): Promise<PlaceAuditEntry[]> {
    const query =
      placeId && placeId !== 'all'
        ? 'SELECT * FROM place_audit_log WHERE place_id = $1 ORDER BY created_at DESC LIMIT $2'
        : 'SELECT * FROM place_audit_log ORDER BY created_at DESC LIMIT $1';

    const params = placeId && placeId !== 'all' ? [placeId, limit] : [limit];
    const res = await this.pool.query(query, params);

    return res.rows.map((r) => ({
      id: r.id,
      placeId: r.place_id,
      adminUserId: r.admin_user_id || 'system',
      adminName: r.admin_name,
      action: r.action,
      previousData: r.previous_data,
      newData: r.new_data,
      changeSummary: r.change_summary,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  }

  async findDuplicates(): Promise<DuplicatePair[]> {
    return this.findDuplicatesAsync();
  }

  async findDuplicatesAsync(): Promise<DuplicatePair[]> {
    const res = await this.pool.query("SELECT * FROM places WHERE status != 'ARCHIVED'");
    const all: AdminPlaceRecord[] = [];

    for (const r of res.rows) {
      all.push(this.mapRowToPlace(r));
    }

    const pairs: DuplicatePair[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const p1 = all[i];
        const p2 = all[j];
        const pairKey = [p1.id, p2.id].sort().join('___');
        if (seen.has(pairKey)) continue;

        const distanceMeters = calculateDistanceMeters(
          p1.coordinates.lat,
          p1.coordinates.lng,
          p2.coordinates.lat,
          p2.coordinates.lng
        );
        const nameSimilarity = calculateStringSimilarity(p1.name, p2.name);
        const sameCategory = p1.category === p2.category;
        const sameLocality = p1.localityId === p2.localityId;

        const reasons: string[] = [];
        if (nameSimilarity > 0.82) {
          reasons.push(`Nombres similares (${Math.round(nameSimilarity * 100)}%)`);
        }
        if (distanceMeters < 150 && (sameCategory || sameLocality)) {
          reasons.push(`Distancia física muy cercana (${distanceMeters}m)`);
        }

        if ((nameSimilarity > 0.82 && distanceMeters < 1500) || (nameSimilarity > 0.60 && distanceMeters < 150)) {
          seen.add(pairKey);
          const primary = p1.verification.isVerified ? p1 : p2;
          const duplicate = p1.verification.isVerified ? p2 : p1;

          pairs.push({
            id: pairKey,
            primaryPlace: primary,
            duplicatePlace: duplicate,
            similarityScore: Math.round(nameSimilarity * 100) / 100,
            distanceMeters,
            reasons,
          });
        }
      }
    }

    return pairs.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  async mergeDuplicates(
    primaryId: string,
    duplicateIds: string[],
    adminUserId: string,
    adminName: string
  ): Promise<{ success: boolean; primaryPlace: AdminPlaceRecord; mergedCount: number }> {
    return this.mergeDuplicatesAsync(primaryId, duplicateIds, adminUserId, adminName);
  }

  /**
   * ATOMIC TRANSACTION:
   * BEGIN -> copy non-duplicate images and sources -> append tags -> archive duplicates -> record audit logs -> COMMIT.
   * On any failure -> ROLLBACK.
   */
  async mergeDuplicatesAsync(
    primaryId: string,
    duplicateIds: string[],
    adminUserId: string,
    adminName: string
  ): Promise<{ success: boolean; primaryPlace: AdminPlaceRecord; mergedCount: number }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const primary = await this.getPlaceByIdAsync(primaryId);
      if (!primary) {
        throw new Error(`Lugar principal ${primaryId} no encontrado`);
      }

      const isMergeSystem = !adminUserId || adminUserId === 'system' || !adminUserId.startsWith('user_');
      const resolvedUserId = isMergeSystem ? null : adminUserId;
      const resolvedAdminName = adminName || (isMergeSystem ? 'Sistema LibertadGO' : 'Administrador');

      let mergedCount = 0;
      for (const dupId of duplicateIds) {
        if (dupId === primaryId) continue;
        const dup = await this.getPlaceByIdAsync(dupId);
        if (!dup) continue;

        // 1. Transfer images
        for (const img of dup.images) {
          if (!primary.images.some((pi) => pi.url === img.url)) {
            await client.query(
              `INSERT INTO place_images (
                id, place_id, url, caption, author, license, is_cover, order_index, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, FALSE, 99, NOW())
              ON CONFLICT DO NOTHING`,
              [
                `img_mrg_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                primaryId,
                img.url,
                img.caption || null,
                img.author || null,
                img.license || null,
              ]
            );
          }
        }

        // 2. Transfer sources
        for (const src of dup.sources) {
          await client.query(
            `INSERT INTO place_sources (
              id, place_id, source_id, external_id, raw_data_ref, last_synced_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT DO NOTHING`,
            [
              `src_mrg_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              primaryId,
              src.sourceId,
              src.externalId,
              src.rawDataRef || null,
            ]
          );
        }

        // 3. Archive duplicate place
        await client.query(
          `UPDATE places SET status = 'ARCHIVED', updated_by = $1, updated_at = NOW() WHERE id = $2`,
          [resolvedUserId, dupId]
        );

        // 4. Audit log for archived duplicate
        await client.query(
          `INSERT INTO place_audit_log (
            id, place_id, actor_type, admin_user_id, admin_name, action,
            previous_data, new_data, change_summary, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            dupId,
            isMergeSystem ? 'SYSTEM' : 'ADMIN',
            resolvedUserId,
            resolvedAdminName,
            'ARCHIVE',
            JSON.stringify({ status: dup.status }),
            JSON.stringify({ status: 'ARCHIVED' }),
            `Lugar archivado por fusión hacia el lugar principal "${primary.name}" (${primary.id}).`,
          ]
        );

        mergedCount++;
      }

      // 5. Audit log for primary place
      await client.query(
        `INSERT INTO place_audit_log (
          id, place_id, actor_type, admin_user_id, admin_name, action,
          previous_data, new_data, change_summary, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, $7, NOW())`,
        [
          `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          primaryId,
          isMergeSystem ? 'SYSTEM' : 'ADMIN',
          resolvedUserId,
          resolvedAdminName,
          'MERGE',
          `Fusión atómica exitosa: se integraron ${mergedCount} lugares duplicados hacia "${primary.name}".`,
        ]
      );

      await client.query('COMMIT');

      const updatedPrimary = await this.getPlaceByIdAsync(primaryId);
      return {
        success: true,
        primaryPlace: updatedPrimary!,
        mergedCount,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getCategoriesStats(): Promise<{ category: string; count: number; published: number }[]> {
    return this.getCategoriesStatsAsync();
  }

  async getCategoriesStatsAsync(): Promise<{ category: string; count: number; published: number }[]> {
    const res = await this.pool.query(`
      SELECT
        category,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'PUBLISHED') as published
      FROM places
      GROUP BY category
    `);

    return res.rows.map((r) => ({
      category: r.category,
      count: parseInt(r.total, 10),
      published: parseInt(r.published, 10),
    }));
  }

  async getLocalitiesStats(): Promise<{ localityId: string; localityName: string; count: number; published: number }[]> {
    return this.getLocalitiesStatsAsync();
  }

  async getLocalitiesStatsAsync(): Promise<{ localityId: string; localityName: string; count: number; published: number }[]> {
    const res = await this.pool.query(`
      SELECT
        locality_id,
        locality_name,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'PUBLISHED') as published
      FROM places
      GROUP BY locality_id, locality_name
    `);

    return res.rows.map((r) => ({
      localityId: r.locality_id,
      localityName: r.locality_name,
      count: parseInt(r.total, 10),
      published: parseInt(r.published, 10),
    }));
  }

  async getSourcesStats(): Promise<{ sourceId: string; count: number }[]> {
    return this.getSourcesStatsAsync();
  }

  async getSourcesStatsAsync(): Promise<{ sourceId: string; count: number }[]> {
    const res = await this.pool.query(`
      SELECT source_id, COUNT(*) as count
      FROM place_sources
      GROUP BY source_id
    `);

    return res.rows.map((r) => ({
      sourceId: r.source_id,
      count: parseInt(r.count, 10),
    }));
  }

  async getDashboardMetrics(): Promise<AdminDashboardMetrics> {
    return this.getDashboardMetricsAsync();
  }

  async getDashboardMetricsAsync(): Promise<AdminDashboardMetrics> {
    const totalRes = await this.pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'PUBLISHED') as published,
        COUNT(*) FILTER (WHERE status = 'DRAFT') as draft,
        COUNT(*) FILTER (WHERE status = 'FLAGGED') as flagged,
        COUNT(*) FILTER (WHERE status = 'ARCHIVED') as archived,
        COUNT(*) FILTER (WHERE is_verified = TRUE) as verified
      FROM places
    `);

    const r = totalRes.rows[0];
    const total = parseInt(r.total, 10);
    const verified = parseInt(r.verified, 10);

    const categories = await this.getCategoriesStatsAsync();
    const localities = await this.getLocalitiesStatsAsync();
    const sources = await this.getSourcesStatsAsync();
    const duplicates = await this.findDuplicatesAsync();
    const auditLogs = await this.getAuditLogsAsync('all', 12);

    return {
      totalPlaces: total,
      publishedCount: parseInt(r.published, 10),
      draftCount: parseInt(r.draft, 10),
      flaggedCount: parseInt(r.flagged, 10),
      archivedCount: parseInt(r.archived, 10),
      verifiedCount: verified,
      unverifiedCount: total - verified,
      placesByCategory: categories,
      placesByLocality: localities,
      sourcesDistribution: sources,
      potentialDuplicatesCount: duplicates.length,
      recentAuditLogs: auditLogs,
    };
  }

  async getPublicPlaces(filters?: { localityId?: string; category?: string; search?: string }): Promise<Place[]> {
    return this.getPublicPlacesAsync(filters);
  }

  async getPublicPlacesAsync(filters?: { localityId?: string; category?: string; search?: string }): Promise<Place[]> {
    const conditions = ["status = 'PUBLISHED'"];
    const values: any[] = [];
    let idx = 1;

    if (filters?.localityId && filters.localityId !== 'todas') {
      conditions.push(`LOWER(locality_id) = $${idx}`);
      values.push(filters.localityId.toLowerCase().trim());
      idx++;
    }

    if (filters?.category && filters.category !== 'todas') {
      conditions.push(`LOWER(category) = $${idx}`);
      values.push(filters.category.toLowerCase().trim());
      idx++;
    }

    if (filters?.search) {
      const q = `%${filters.search.toLowerCase().trim()}%`;
      conditions.push(`(
        LOWER(name) LIKE $${idx} OR
        LOWER(address) LIKE $${idx} OR
        LOWER(short_description) LIKE $${idx}
      )`);
      values.push(q);
      idx++;
    }

    const query = `
      SELECT p.*,
        COALESCE(json_agg(DISTINCT img.*) FILTER (WHERE img.id IS NOT NULL), '[]') as images_json,
        COALESCE(json_agg(DISTINCT src.*) FILTER (WHERE src.id IS NOT NULL), '[]') as sources_json,
        COALESCE(json_agg(DISTINCT hrs.*) FILTER (WHERE hrs.id IS NOT NULL), '[]') as hours_json
      FROM places p
      LEFT JOIN place_images img ON img.place_id = p.id
      LEFT JOIN place_sources src ON src.place_id = p.id
      LEFT JOIN place_opening_hours hrs ON hrs.place_id = p.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY p.id
      ORDER BY p.name ASC
    `;

    const res = await this.pool.query(query, values);
    return res.rows
      .map((row) => {
        const images: PlaceImage[] = (row.images_json || []).map((img: any) => ({
          id: img.id,
          url: img.url,
          caption: img.caption || undefined,
          author: img.author || undefined,
          license: img.license || undefined,
          isCover: Boolean(img.is_cover),
        }));

        const sources: PlaceSource[] = (row.sources_json || []).map((s: any) => ({
          placeId: s.place_id,
          sourceId: s.source_id,
          externalId: s.external_id,
          rawDataRef: s.raw_data_ref || undefined,
          lastSyncedAt: s.last_synced_at ? new Date(s.last_synced_at).toISOString() : new Date().toISOString(),
        }));

        const hours: PlaceOpeningHours[] = (row.hours_json || []).map((h: any) => ({
          dayOfWeek: h.day_of_week,
          openTime: h.open_time,
          closeTime: h.close_time,
          isClosed: Boolean(h.is_closed),
        }));

        return this.mapRowToPlace(row, images, sources, hours);
      })
      .filter((p) => isWithinLaLibertad(p.coordinates));
  }
}
