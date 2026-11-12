/**
 * PostgreSQL Implementation of IAuthRepository and ICreatorsRepository
 * Connects to PostgreSQL using 'pg' connection pooling.
 * Activated whenever process.env.DATABASE_URL is provided.
 */

import { Pool } from 'pg';
import {
  IAuthRepository,
  ICreatorsRepository,
  VideoFilterOptions,
  AdminMetrics,
} from './interfaces.ts';
import {
  User,
  CreatorProfile,
  VideoSubmission,
  VideoModerationLog,
  VideoPlatform,
  ModerationStatus,
  ModerationActionType,
  ModerationAuditPayload,
  VideoExternalMetrics,
} from '../../types/creators.ts';
import { Place } from '../../types/catalog.ts';
import { INITIAL_PLACES } from '../../data/initialPlaces.ts';

const AUDIT_META_PREFIX = '__AUDIT_META__:';
const AUDIT_META_SUFFIX = ':__AUDIT_END__';

export function serializeInternalNotes(
  action: ModerationActionType,
  changedFields?: string[] | null,
  internalNotes?: string | null
): string {
  const meta = {
    action,
    changedFields: changedFields || null,
  };
  const metaStr = `${AUDIT_META_PREFIX}${JSON.stringify(meta)}${AUDIT_META_SUFFIX}`;
  return internalNotes ? `${metaStr} ${internalNotes}` : metaStr;
}

export function parseModerationLogRow(row: any): VideoModerationLog {
  let action: ModerationActionType = 'UPDATE';
  let changedFields: string[] | null = null;
  let cleanNotes = row.internalNotes;

  if (row.action) {
    action = row.action;
    changedFields = row.changedFields || null;
  } else if (typeof row.internalNotes === 'string' && row.internalNotes.includes(AUDIT_META_PREFIX)) {
    try {
      const start = row.internalNotes.indexOf(AUDIT_META_PREFIX);
      const end = row.internalNotes.indexOf(AUDIT_META_SUFFIX, start);
      if (start !== -1 && end !== -1) {
        const jsonStr = row.internalNotes.substring(start + AUDIT_META_PREFIX.length, end);
        const meta = JSON.parse(jsonStr);
        if (meta.action) action = meta.action;
        if (meta.changedFields) changedFields = meta.changedFields;
        cleanNotes = (row.internalNotes.substring(0, start) + row.internalNotes.substring(end + AUDIT_META_SUFFIX.length)).trim() || null;
      }
    } catch {
      // fallback
    }
  } else {
    // Inference from status transition
    if (row.previousStatus === 'NONE' || !row.previousStatus) {
      action = 'CREATE';
    } else if (row.previousStatus === row.newStatus) {
      action = 'UPDATE';
    } else if (row.newStatus === 'APPROVED') {
      action = 'APPROVE';
    } else if (row.newStatus === 'REJECTED') {
      action = 'REJECT';
    } else if (row.newStatus === 'OBSERVED') {
      action = 'OBSERVE';
    } else if (row.newStatus === 'HIDDEN') {
      action = 'HIDE';
    }
  }

  return {
    id: row.id,
    videoId: row.videoId,
    adminUserId: row.adminUserId,
    adminName: row.adminName,
    action,
    previousStatus: row.previousStatus === 'NONE' || !row.previousStatus ? null : row.previousStatus,
    newStatus: row.newStatus,
    reason: row.reason || null,
    internalNotes: cleanNotes,
    changedFields,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

export function mapVideoSubmissionRow(row: any): VideoSubmission {
  if (!row) return row;
  let metrics = row.externalMetrics;
  if (typeof metrics === 'string') {
    try {
      metrics = JSON.parse(metrics);
    } catch {
      metrics = null;
    }
  }

  return {
    ...row,
    externalMetrics: metrics || null,
    externalCreatorHandle: row.externalCreatorHandle || metrics?.creatorHandle || null,
    externalCreatorDisplayName: row.externalCreatorDisplayName || metrics?.creatorDisplayName || null,
    externalCreatorAvatarUrl: row.externalCreatorAvatarUrl || metrics?.creatorAvatarUrl || null,
  };
}

export class PostgresCreatorsRepository implements IAuthRepository, ICreatorsRepository {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: process.env.NODE_ENV === 'production' ? 10000 : 2000,
    });

    // Handle idle client errors without leaking sensitive connection details
    this.pool.on('error', (err) => {
      console.error('[Neon Pool Idle Error]', err?.message || err);
    });
  }

  /**
   * Verify database connectivity with a lightweight ping query
   */
  async testConnection(): Promise<void> {
    const res = await this.pool.query('SELECT 1 as ping');
    if (!res || !res.rows || res.rows.length === 0) {
      throw new Error('Database ping query returned no results.');
    }
  }

  /**
   * Close all active and idle connections in the pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }


  // --- IAuthRepository ---

  async findUserByEmail(email: string): Promise<User | null> {
    const res = await this.pool.query(
      `SELECT id, email, password_hash as "passwordHash", name, avatar_url as "avatarUrl", role, created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    return res.rows[0] || null;
  }

  async findUserById(id: string): Promise<User | null> {
    const res = await this.pool.query(
      `SELECT id, email, password_hash as "passwordHash", name, avatar_url as "avatarUrl", role, created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    name: string;
    role?: 'USER' | 'ADMIN';
    avatarUrl?: string | null;
  }): Promise<User> {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const role = data.role || 'USER';
    const res = await this.pool.query(
      `INSERT INTO users (id, email, password_hash, name, avatar_url, role)
       VALUES ($1, LOWER($2), $3, $4, $5, $6)
       RETURNING id, email, password_hash as "passwordHash", name, avatar_url as "avatarUrl", role, created_at as "createdAt", updated_at as "updatedAt"`,
      [id, data.email, data.passwordHash, data.name, data.avatarUrl || null, role]
    );
    return res.rows[0];
  }

  async countUsers(): Promise<number> {
    const res = await this.pool.query(`SELECT COUNT(*)::int as count FROM users`);
    return res.rows[0]?.count || 0;
  }

  async listUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    const res = await this.pool.query(`
      SELECT id, email, name, avatar_url as "avatarUrl", role, created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      ORDER BY created_at DESC
    `);
    return res.rows;
  }

  // --- ICreatorsRepository ---

  async findSubmissionById(id: string): Promise<VideoSubmission | null> {
    const res = await this.pool.query(
      `SELECT id, user_id as "userId", creator_profile_id as "creatorProfileId", platform, external_video_id as "externalVideoId",
              video_url as "videoUrl", embed_url as "embedUrl", thumbnail_url as "thumbnailUrl", title, description,
              content_type as "contentType", category, locality_id as "localityId", status, moderation_notes as "moderationNotes",
              moderated_by as "moderatedBy", moderated_at as "moderatedAt", internal_views_count as "internalViewsCount",
              internal_saves_count as "internalSavesCount", external_metrics as "externalMetrics",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM video_submissions WHERE id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapVideoSubmissionRow(res.rows[0]) : null;
  }

  async findSubmissionByPlatformAndExternalId(
    platform: VideoPlatform,
    externalVideoId: string
  ): Promise<VideoSubmission | null> {
    const res = await this.pool.query(
      `SELECT id, user_id as "userId", creator_profile_id as "creatorProfileId", platform, external_video_id as "externalVideoId",
              video_url as "videoUrl", embed_url as "embedUrl", thumbnail_url as "thumbnailUrl", title, description,
              content_type as "contentType", category, locality_id as "localityId", status, moderation_notes as "moderationNotes",
              moderated_by as "moderatedBy", moderated_at as "moderatedAt", internal_views_count as "internalViewsCount",
              internal_saves_count as "internalSavesCount", external_metrics as "externalMetrics",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM video_submissions WHERE platform = $1 AND external_video_id = $2 LIMIT 1`,
      [platform, externalVideoId]
    );
    return res.rows[0] ? mapVideoSubmissionRow(res.rows[0]) : null;
  }

  async createSubmission(
    data: {
      userId: string;
      creatorProfileId?: string | null;
      platform: VideoPlatform;
      externalVideoId: string;
      videoUrl: string;
      embedUrl: string;
      thumbnailUrl?: string | null;
      title: string;
      description?: string | null;
      contentType: 'PLACE' | 'ROUTE' | 'GENERAL';
      category: string;
      localityId?: string | null;
      status?: ModerationStatus;
      externalCreatorHandle?: string | null;
      externalCreatorDisplayName?: string | null;
      externalCreatorAvatarUrl?: string | null;
    },
    placeIds: string[] = [],
    primaryPlaceId?: string | null,
    audit?: ModerationAuditPayload
  ): Promise<VideoSubmission> {
    const id = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const client = await this.pool.connect();
    const initialStatus = data.status || 'PENDING';

    const externalMetrics = {
      ...(data.externalCreatorHandle ? { creatorHandle: data.externalCreatorHandle } : {}),
      ...(data.externalCreatorDisplayName ? { creatorDisplayName: data.externalCreatorDisplayName } : {}),
      ...(data.externalCreatorAvatarUrl ? { creatorAvatarUrl: data.externalCreatorAvatarUrl } : {}),
    };
    const metricsParam = Object.keys(externalMetrics).length > 0 ? JSON.stringify(externalMetrics) : null;

    try {
      await client.query('BEGIN');

      const res = await client.query(
        `INSERT INTO video_submissions (
          id, user_id, creator_profile_id, platform, external_video_id,
          video_url, embed_url, thumbnail_url, title, description,
          content_type, category, locality_id, status, external_metrics
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
        RETURNING id, user_id as "userId", creator_profile_id as "creatorProfileId", platform, external_video_id as "externalVideoId",
                  video_url as "videoUrl", embed_url as "embedUrl", thumbnail_url as "thumbnailUrl", title, description,
                  content_type as "contentType", category, locality_id as "localityId", status, moderation_notes as "moderationNotes",
                  moderated_by as "moderatedBy", moderated_at as "moderatedAt", internal_views_count as "internalViewsCount",
                  internal_saves_count as "internalSavesCount", external_metrics as "externalMetrics",
                  created_at as "createdAt", updated_at as "updatedAt"`,
        [
          id,
          data.userId,
          data.creatorProfileId || null,
          data.platform,
          data.externalVideoId,
          data.videoUrl,
          data.embedUrl,
          data.thumbnailUrl || null,
          data.title,
          data.description || null,
          data.contentType,
          data.category,
          data.localityId || null,
          initialStatus,
          metricsParam,
        ]
      );

      const submission: VideoSubmission = mapVideoSubmissionRow(res.rows[0]);

      // Deduplicate placeIds and validate primaryPlaceId
      const uniquePlaceIds = Array.from(new Set(placeIds || []));
      if (primaryPlaceId && uniquePlaceIds.length > 0 && !uniquePlaceIds.includes(primaryPlaceId)) {
        throw new Error('primaryPlaceId must be one of the associated placeIds');
      }
      const effectivePrimaryId = primaryPlaceId || (uniquePlaceIds.length > 0 ? uniquePlaceIds[0] : null);

      // Associate places
      for (const pId of uniquePlaceIds) {
        const isPrimary = effectivePrimaryId === pId;
        const vpId = `vp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await client.query(
          `INSERT INTO video_places (id, video_id, place_id, is_primary)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (video_id, place_id) DO NOTHING`,
          [vpId, id, pId, isPrimary]
        );
      }

      // Record audit log within the SAME atomic transaction
      if (audit) {
        const logId = `mod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const encodedNotes = serializeInternalNotes(audit.action, audit.changedFields, audit.internalNotes);
        const dbPrevStatus = audit.previousStatus || 'NONE';
        await client.query(
          `INSERT INTO video_moderation_logs (id, video_id, admin_user_id, admin_name, previous_status, new_status, reason, internal_notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [logId, id, audit.adminUserId, audit.adminName, dbPrevStatus, audit.newStatus, audit.reason || null, encodedNotes]
        );
      }

      await client.query('COMMIT');
      return submission;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateSubmission(
    id: string,
    data: Partial<{
      title: string;
      description: string | null;
      contentType: 'PLACE' | 'ROUTE' | 'GENERAL';
      category: string;
      localityId: string | null;
      thumbnailUrl: string | null;
      creatorProfileId: string | null;
      status: ModerationStatus;
      externalCreatorHandle: string | null;
      externalCreatorDisplayName: string | null;
      externalCreatorAvatarUrl: string | null;
      externalMetrics?: VideoExternalMetrics | null;
    }>,
    placeIds?: string[],
    primaryPlaceId?: string | null,
    audit?: ModerationAuditPayload
  ): Promise<VideoSubmission | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const existingRes = await client.query(
        `SELECT id, user_id as "userId", creator_profile_id as "creatorProfileId", platform, external_video_id as "externalVideoId",
                video_url as "videoUrl", embed_url as "embedUrl", thumbnail_url as "thumbnailUrl", title, description,
                content_type as "contentType", category, locality_id as "localityId", status, moderation_notes as "moderationNotes",
                moderated_by as "moderatedBy", moderated_at as "moderatedAt", internal_views_count as "internalViewsCount",
                internal_saves_count as "internalSavesCount", external_metrics as "externalMetrics",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM video_submissions WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (existingRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const existing = mapVideoSubmissionRow(existingRes.rows[0]);

      let metricsJson: string | null = null;
      if (
        data.externalCreatorHandle !== undefined ||
        data.externalCreatorDisplayName !== undefined ||
        data.externalCreatorAvatarUrl !== undefined ||
        data.externalMetrics !== undefined
      ) {
        const mergedMetrics = {
          ...(existing.externalMetrics || {}),
          ...(data.externalMetrics !== undefined ? data.externalMetrics : {}),
          ...(data.externalCreatorHandle !== undefined ? { creatorHandle: data.externalCreatorHandle } : {}),
          ...(data.externalCreatorDisplayName !== undefined ? { creatorDisplayName: data.externalCreatorDisplayName } : {}),
          ...(data.externalCreatorAvatarUrl !== undefined ? { creatorAvatarUrl: data.externalCreatorAvatarUrl } : {}),
        };
        metricsJson = JSON.stringify(mergedMetrics);
      }

      const setClauses: string[] = [];
      const params: any[] = [];

      if (data.title !== undefined) {
        params.push(data.title);
        setClauses.push(`title = $${params.length}`);
      }
      if (data.description !== undefined) {
        params.push(data.description);
        setClauses.push(`description = $${params.length}`);
      }
      if (data.contentType !== undefined) {
        params.push(data.contentType);
        setClauses.push(`content_type = $${params.length}`);
      }
      if (data.category !== undefined) {
        params.push(data.category);
        setClauses.push(`category = $${params.length}`);
      }
      if (data.localityId !== undefined) {
        params.push(data.localityId);
        setClauses.push(`locality_id = $${params.length}`);
      }
      if (data.thumbnailUrl !== undefined) {
        params.push(data.thumbnailUrl);
        setClauses.push(`thumbnail_url = $${params.length}`);
      }
      if (data.creatorProfileId !== undefined) {
        params.push(data.creatorProfileId);
        setClauses.push(`creator_profile_id = $${params.length}`);
      }
      if (data.status !== undefined) {
        params.push(data.status);
        setClauses.push(`status = $${params.length}`);
      }
      if (metricsJson !== null) {
        params.push(metricsJson);
        setClauses.push(`external_metrics = $${params.length}::jsonb`);
      }

      setClauses.push('updated_at = NOW()');

      params.push(id);
      const idParamIndex = params.length;

      const res = await client.query(
        `UPDATE video_submissions
         SET ${setClauses.join(', ')}
         WHERE id = $${idParamIndex}
         RETURNING id, user_id as "userId", creator_profile_id as "creatorProfileId", platform, external_video_id as "externalVideoId",
                   video_url as "videoUrl", embed_url as "embedUrl", thumbnail_url as "thumbnailUrl", title, description,
                   content_type as "contentType", category, locality_id as "localityId", status, moderation_notes as "moderationNotes",
                   moderated_by as "moderatedBy", moderated_at as "moderatedAt", internal_views_count as "internalViewsCount",
                   internal_saves_count as "internalSavesCount", external_metrics as "externalMetrics",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        params
      );

      // Handle places association within the same atomic transaction
      if (placeIds !== undefined && Array.isArray(placeIds)) {
        const uniquePlaceIds = Array.from(new Set(placeIds));
        let effectivePrimaryId: string | null = null;

        if (primaryPlaceId !== undefined && primaryPlaceId !== null) {
          if (uniquePlaceIds.length > 0 && !uniquePlaceIds.includes(primaryPlaceId)) {
            throw new Error('primaryPlaceId must be one of the associated placeIds');
          }
          effectivePrimaryId = primaryPlaceId;
        } else {
          // Check if previous primary place is still among the new uniquePlaceIds
          const currentPrimaryRes = await client.query(
            `SELECT place_id FROM video_places WHERE video_id = $1 AND is_primary = true LIMIT 1`,
            [id]
          );
          const currentPrimaryId = currentPrimaryRes.rows[0]?.place_id;
          if (currentPrimaryId && uniquePlaceIds.includes(currentPrimaryId)) {
            effectivePrimaryId = currentPrimaryId;
          } else {
            effectivePrimaryId = uniquePlaceIds.length > 0 ? uniquePlaceIds[0] : null;
          }
        }

        await client.query(`DELETE FROM video_places WHERE video_id = $1`, [id]);
        for (const pId of uniquePlaceIds) {
          const isPrimary = effectivePrimaryId === pId;
          const vpId = `vp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await client.query(
            `INSERT INTO video_places (id, video_id, place_id, is_primary)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (video_id, place_id) DO NOTHING`,
            [vpId, id, pId, isPrimary]
          );
        }
      } else if (primaryPlaceId !== undefined && primaryPlaceId !== null) {
        // Only primaryPlaceId changed without changing placeIds
        const existingPlacesRes = await client.query(
          `SELECT place_id FROM video_places WHERE video_id = $1`,
          [id]
        );
        const existingPlaceIds = existingPlacesRes.rows.map((r: { place_id: string }) => r.place_id);
        if (!existingPlaceIds.includes(primaryPlaceId)) {
          throw new Error('primaryPlaceId must be one of the associated placeIds');
        }
        await client.query(
          `UPDATE video_places SET is_primary = (place_id = $1) WHERE video_id = $2`,
          [primaryPlaceId, id]
        );
      }

      // Record audit log within the SAME atomic transaction
      if (audit) {
        const logId = `mod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const encodedNotes = serializeInternalNotes(audit.action, audit.changedFields, audit.internalNotes);
        const dbPrevStatus = audit.previousStatus || existing.status || 'NONE';
        await client.query(
          `INSERT INTO video_moderation_logs (id, video_id, admin_user_id, admin_name, previous_status, new_status, reason, internal_notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [logId, id, audit.adminUserId, audit.adminName, dbPrevStatus, audit.newStatus, audit.reason || null, encodedNotes]
        );
      }

      await client.query('COMMIT');
      return res.rows[0] ? mapVideoSubmissionRow(res.rows[0]) : null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateSubmissionStatus(
    id: string,
    status: ModerationStatus,
    notes?: string | null,
    adminUserId?: string,
    audit?: ModerationAuditPayload,
    placeIds?: string[]
  ): Promise<VideoSubmission | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const existingRes = await client.query(
        `SELECT id, status FROM video_submissions WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (existingRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const prevStatus = existingRes.rows[0].status;

      const res = await client.query(
        `UPDATE video_submissions
         SET status = $1,
             moderation_notes = $2,
             moderated_by = $3,
             moderated_at = NOW(),
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, user_id as "userId", creator_profile_id as "creatorProfileId", platform, external_video_id as "externalVideoId",
                   video_url as "videoUrl", embed_url as "embedUrl", thumbnail_url as "thumbnailUrl", title, description,
                   content_type as "contentType", category, locality_id as "localityId", status, moderation_notes as "moderationNotes",
                   moderated_by as "moderatedBy", moderated_at as "moderatedAt", internal_views_count as "internalViewsCount",
                   internal_saves_count as "internalSavesCount", external_metrics as "externalMetrics",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [status, notes || null, adminUserId || null, id]
      );

      // Update places if verified places provided
      if (placeIds && Array.isArray(placeIds)) {
        await client.query(`DELETE FROM video_places WHERE video_id = $1`, [id]);
        for (let i = 0; i < placeIds.length; i++) {
          const pId = placeIds[i];
          const isPrimary = i === 0;
          const vpId = `vp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await client.query(
            `INSERT INTO video_places (id, video_id, place_id, is_primary)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (video_id, place_id) DO NOTHING`,
            [vpId, id, pId, isPrimary]
          );
        }
      }

      // Record audit log within the SAME atomic transaction
      if (audit) {
        const logId = `mod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const encodedNotes = serializeInternalNotes(audit.action, audit.changedFields, audit.internalNotes || notes);
        const dbPrevStatus = audit.previousStatus || prevStatus || 'NONE';
        await client.query(
          `INSERT INTO video_moderation_logs (id, video_id, admin_user_id, admin_name, previous_status, new_status, reason, internal_notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [logId, id, audit.adminUserId, audit.adminName, dbPrevStatus, audit.newStatus, audit.reason || null, encodedNotes]
        );
      }

      await client.query('COMMIT');
      return res.rows[0] ? mapVideoSubmissionRow(res.rows[0]) : null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listApprovedVideos(
    filters: VideoFilterOptions = {}
  ): Promise<{ videos: (VideoSubmission & { places: Place[] })[]; total: number }> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [`vs.status = 'APPROVED'`];
    const params: unknown[] = [];

    if (filters.localityId && filters.localityId !== 'todas') {
      params.push(filters.localityId);
      conditions.push(`vs.locality_id = $${params.length}`);
    }

    if (filters.category && filters.category !== 'todas') {
      params.push(filters.category);
      conditions.push(`vs.category = $${params.length}`);
    }

    if (filters.contentType) {
      params.push(filters.contentType);
      conditions.push(`vs.content_type = $${params.length}`);
    }

    if (filters.platform) {
      params.push(filters.platform);
      conditions.push(`vs.platform = $${params.length}`);
    }

    if (filters.q) {
      params.push(`%${filters.q.toLowerCase()}%`);
      conditions.push(`(LOWER(vs.title) LIKE $${params.length} OR LOWER(vs.description) LIKE $${params.length})`);
    }

    if (filters.placeId) {
      params.push(filters.placeId);
      conditions.push(`EXISTS (SELECT 1 FROM video_places vp WHERE vp.video_id = vs.id AND vp.place_id = $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int as total FROM video_submissions vs ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const queryParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const res = await this.pool.query(
      `SELECT vs.id, vs.user_id as "userId", vs.creator_profile_id as "creatorProfileId", vs.platform,
              vs.external_video_id as "externalVideoId", vs.video_url as "videoUrl", vs.embed_url as "embedUrl",
              vs.thumbnail_url as "thumbnailUrl", vs.title, vs.description, vs.content_type as "contentType",
              vs.category, vs.locality_id as "localityId", vs.status, vs.moderation_notes as "moderationNotes",
              vs.moderated_by as "moderatedBy", vs.moderated_at as "moderatedAt", vs.internal_views_count as "internalViewsCount",
              vs.internal_saves_count as "internalSavesCount", vs.external_metrics as "externalMetrics",
              vs.created_at as "createdAt", vs.updated_at as "updatedAt",
              cp.display_name as "creatorDisplayName",
              cp.handle as "creatorHandle",
              cp.avatar_url as "creatorAvatarUrl",
              u.name as "userName"
       FROM video_submissions vs
       LEFT JOIN creator_profiles cp ON cp.id = vs.creator_profile_id
       LEFT JOIN users u ON u.id = vs.user_id
       ${whereClause}
       ORDER BY vs.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      queryParams
    );

    if (res.rows.length === 0) {
      return { videos: [], total };
    }

    // Batch fetch associated places in a single query instead of N+1
    const videoIds = res.rows.map((r: { id: string }) => r.id);
    const placesRes = await this.pool.query(
      `SELECT video_id as "videoId", place_id as "placeId", is_primary as "isPrimary"
       FROM video_places
       WHERE video_id = ANY($1)
       ORDER BY is_primary DESC`,
      [videoIds]
    );

    const placesByVideoId: Record<string, Place[]> = {};
    for (const row of placesRes.rows as { videoId: string; placeId: string; isPrimary: boolean }[]) {
      const place = INITIAL_PLACES.find((p) => p.id === row.placeId);
      if (place) {
        if (!placesByVideoId[row.videoId]) {
          placesByVideoId[row.videoId] = [];
        }
        placesByVideoId[row.videoId].push(place);
      }
    }

    const videosWithPlaces = res.rows.map((v: VideoSubmission) => ({
      ...mapVideoSubmissionRow(v),
      places: placesByVideoId[v.id] || [],
    }));

    return { videos: videosWithPlaces, total };
  }

  async listSubmissionsByUser(userId: string): Promise<VideoSubmission[]> {
    const res = await this.pool.query(
      `SELECT id, user_id as "userId", creator_profile_id as "creatorProfileId", platform, external_video_id as "externalVideoId",
              video_url as "videoUrl", embed_url as "embedUrl", thumbnail_url as "thumbnailUrl", title, description,
              content_type as "contentType", category, locality_id as "localityId", status, moderation_notes as "moderationNotes",
              moderated_by as "moderatedBy", moderated_at as "moderatedAt", internal_views_count as "internalViewsCount",
              internal_saves_count as "internalSavesCount", external_metrics as "externalMetrics",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM video_submissions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows.map(mapVideoSubmissionRow);
  }

  async listSubmissionsByCreatorProfileId(
    creatorProfileId: string
  ): Promise<VideoSubmission[]> {
    const res = await this.pool.query(
      `SELECT id, user_id as "userId", creator_profile_id as "creatorProfileId", platform, external_video_id as "externalVideoId",
              video_url as "videoUrl", embed_url as "embedUrl", thumbnail_url as "thumbnailUrl", title, description,
              content_type as "contentType", category, locality_id as "localityId", status, moderation_notes as "moderationNotes",
              moderated_by as "moderatedBy", moderated_at as "moderatedAt", internal_views_count as "internalViewsCount",
              internal_saves_count as "internalSavesCount", external_metrics as "externalMetrics",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM video_submissions
       WHERE creator_profile_id = $1
       ORDER BY created_at DESC`,
      [creatorProfileId]
    );
  
    return res.rows.map(mapVideoSubmissionRow);
  }

  async listModerationQueue(status: ModerationStatus = 'PENDING'): Promise<VideoSubmission[]> {
    const res = await this.pool.query(
      `SELECT id, user_id as "userId", creator_profile_id as "creatorProfileId", platform, external_video_id as "externalVideoId",
              video_url as "videoUrl", embed_url as "embedUrl", thumbnail_url as "thumbnailUrl", title, description,
              content_type as "contentType", category, locality_id as "localityId", status, moderation_notes as "moderationNotes",
              moderated_by as "moderatedBy", moderated_at as "moderatedAt", internal_views_count as "internalViewsCount",
              internal_saves_count as "internalSavesCount", external_metrics as "externalMetrics",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM video_submissions
       WHERE status = $1
       ORDER BY created_at ASC`,
      [status]
    );
    return res.rows.map(mapVideoSubmissionRow);
  }

  async addModerationLog(log: {
    videoId: string;
    adminUserId: string;
    adminName: string;
    previousStatus?: ModerationStatus | null;
    newStatus: ModerationStatus;
    reason?: string | null;
    internalNotes?: string | null;
    action?: ModerationActionType;
    changedFields?: string[] | null;
  }): Promise<VideoModerationLog> {
    const id = `mod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let action = log.action;
    if (!action) {
      if (log.previousStatus === null || log.previousStatus === undefined) {
        action = 'CREATE';
      } else if (log.previousStatus === log.newStatus) {
        action = 'UPDATE';
      } else if (log.newStatus === 'APPROVED') {
        action = 'APPROVE';
      } else if (log.newStatus === 'REJECTED') {
        action = 'REJECT';
      } else if (log.newStatus === 'OBSERVED') {
        action = 'OBSERVE';
      } else if (log.newStatus === 'HIDDEN') {
        action = 'HIDE';
      } else {
        action = 'UPDATE';
      }
    }
    const encodedNotes = serializeInternalNotes(action, log.changedFields, log.internalNotes);
    const dbPrevStatus = log.previousStatus || 'NONE';
    const res = await this.pool.query(
      `INSERT INTO video_moderation_logs (id, video_id, admin_user_id, admin_name, previous_status, new_status, reason, internal_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, video_id as "videoId", admin_user_id as "adminUserId", admin_name as "adminName",
                 previous_status as "previousStatus", new_status as "newStatus", reason, internal_notes as "internalNotes",
                 created_at as "createdAt"`,
      [id, log.videoId, log.adminUserId, log.adminName, dbPrevStatus, log.newStatus, log.reason || null, encodedNotes]
    );
    return parseModerationLogRow(res.rows[0]);
  }

  async getModerationLogs(videoId: string): Promise<VideoModerationLog[]> {
    const res = await this.pool.query(
      `SELECT id, video_id as "videoId", admin_user_id as "adminUserId", admin_name as "adminName",
              previous_status as "previousStatus", new_status as "newStatus", reason, internal_notes as "internalNotes",
              created_at as "createdAt"
       FROM video_moderation_logs
       WHERE video_id = $1
       ORDER BY created_at DESC`,
      [videoId]
    );
    return res.rows.map(parseModerationLogRow);
  }

  async associatePlaces(
    videoId: string,
    placeIds: string[],
    primaryPlaceId?: string | null
  ): Promise<void> {
    const uniquePlaceIds = Array.from(new Set(placeIds || []));
    if (primaryPlaceId && uniquePlaceIds.length > 0 && !uniquePlaceIds.includes(primaryPlaceId)) {
      throw new Error('primaryPlaceId must be one of the associated placeIds');
    }
    const effectivePrimaryId = primaryPlaceId || (uniquePlaceIds.length > 0 ? uniquePlaceIds[0] : null);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM video_places WHERE video_id = $1`, [videoId]);
      for (const pId of uniquePlaceIds) {
        const isPrimary = effectivePrimaryId === pId;
        const vpId = `vp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await client.query(
          `INSERT INTO video_places (id, video_id, place_id, is_primary)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (video_id, place_id) DO NOTHING`,
          [vpId, videoId, pId, isPrimary]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getPlacesForVideo(videoId: string): Promise<Place[]> {
    const res = await this.pool.query(
      `SELECT place_id as "placeId" FROM video_places WHERE video_id = $1 ORDER BY is_primary DESC, created_at ASC`,
      [videoId]
    );
    const placeIds = res.rows.map((r: { placeId: string }) => r.placeId);
    return placeIds
      .map((id) => INITIAL_PLACES.find((p) => p.id === id))
      .filter((p): p is Place => p !== undefined);
  }

  async getPlacesForVideos(videoIds: string[]): Promise<Record<string, Place[]>> {
    const map: Record<string, Place[]> = {};
    if (!videoIds || videoIds.length === 0) return map;
    for (const id of videoIds) {
      map[id] = [];
    }
    const res = await this.pool.query(
      `SELECT video_id as "videoId", place_id as "placeId" FROM video_places WHERE video_id = ANY($1::text[]) ORDER BY is_primary DESC, created_at ASC`,
      [videoIds]
    );
    for (const r of res.rows) {
      const place = INITIAL_PLACES.find((p) => p.id === r.placeId);
      if (place && map[r.videoId]) {
        map[r.videoId].push(place);
      }
    }
    return map;
  }

  async getVideosForPlace(placeId: string): Promise<VideoSubmission[]> {
    const res = await this.pool.query(
      `SELECT vs.id, vs.user_id as "userId", vs.creator_profile_id as "creatorProfileId", vs.platform,
              vs.external_video_id as "externalVideoId", vs.video_url as "videoUrl", vs.embed_url as "embedUrl",
              vs.thumbnail_url as "thumbnailUrl", vs.title, vs.description, vs.content_type as "contentType",
              vs.category, vs.locality_id as "localityId", vs.status, vs.moderation_notes as "moderationNotes",
              vs.moderated_by as "moderatedBy", vs.moderated_at as "moderatedAt", vs.internal_views_count as "internalViewsCount",
              vs.internal_saves_count as "internalSavesCount", vs.external_metrics as "externalMetrics",
              vs.created_at as "createdAt", vs.updated_at as "updatedAt",
              cp.display_name as "creatorDisplayName",
              cp.handle as "creatorHandle",
              cp.avatar_url as "creatorAvatarUrl",
              u.name as "userName"
       FROM video_submissions vs
       INNER JOIN video_places vp ON vp.video_id = vs.id
       LEFT JOIN creator_profiles cp ON cp.id = vs.creator_profile_id
       LEFT JOIN users u ON u.id = vs.user_id
       WHERE vp.place_id = $1 AND vs.status = 'APPROVED'
       ORDER BY vs.created_at DESC`,
      [placeId]
    );
    return res.rows.map(mapVideoSubmissionRow);
  }

 
  async findCreatorProfileByUserId(userId: string): Promise<CreatorProfile | null> {
    const res = await this.pool.query(
      `SELECT id, user_id as "userId", handle, display_name as "displayName",
              bio, avatar_url as "avatarUrl",
              primary_platform as "primaryPlatform",
              tiktok_url as "tiktokUrl",
              instagram_url as "instagramUrl",
              youtube_url as "youtubeUrl",
              is_public as "isPublic",
              is_verified as "isVerified",
              total_approved_videos as "totalApprovedVideos",
              created_at as "createdAt",
              updated_at as "updatedAt"
       FROM creator_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    return res.rows[0] || null;
  }

  async findCreatorProfileById(id: string): Promise<CreatorProfile | null> {
    const res = await this.pool.query(
      `SELECT id, user_id as "userId", handle, display_name as "displayName",
              bio, avatar_url as "avatarUrl",
              primary_platform as "primaryPlatform",
              tiktok_url as "tiktokUrl",
              instagram_url as "instagramUrl",
              youtube_url as "youtubeUrl",
              is_public as "isPublic",
              is_verified as "isVerified",
              total_approved_videos as "totalApprovedVideos",
              created_at as "createdAt",
              updated_at as "updatedAt"
       FROM creator_profiles
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    return res.rows[0] || null;
  }

  async findCreatorProfileByHandle(handle: string): Promise<CreatorProfile | null> {
    const res = await this.pool.query(
      `SELECT id, user_id as "userId", handle, display_name as "displayName",
              bio, avatar_url as "avatarUrl",
              primary_platform as "primaryPlatform",
              tiktok_url as "tiktokUrl",
              instagram_url as "instagramUrl",
              youtube_url as "youtubeUrl",
              is_public as "isPublic",
              is_verified as "isVerified",
              total_approved_videos as "totalApprovedVideos",
              created_at as "createdAt",
              updated_at as "updatedAt"
       FROM creator_profiles
       WHERE LOWER(handle) = LOWER($1)
       LIMIT 1`,
      [handle]
    );

    return res.rows[0] || null;
  }

  // Mantiene la compatibilidad con perfiles vinculados a una cuenta.
  async saveCreatorProfile(data: {
    userId: string;
    handle: string;
    displayName: string;
    bio?: string | null;
    avatarUrl?: string | null;
    primaryPlatform: VideoPlatform;
    tiktokUrl?: string | null;
    instagramUrl?: string | null;
    youtubeUrl?: string | null;
    isPublic: boolean;
    isVerified?: boolean;
  }): Promise<CreatorProfile> {
    const id = `cp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const res = await this.pool.query(
      `INSERT INTO creator_profiles (
        id, user_id, handle, display_name, bio, avatar_url,
        primary_platform, tiktok_url, instagram_url, youtube_url,
        is_public, is_verified
      )
      VALUES ($1, $2, LOWER($3), $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id) WHERE user_id IS NOT NULL
      DO UPDATE SET
        handle = EXCLUDED.handle,
        display_name = EXCLUDED.display_name,
        bio = EXCLUDED.bio,
        avatar_url = EXCLUDED.avatar_url,
        primary_platform = EXCLUDED.primary_platform,
        tiktok_url = EXCLUDED.tiktok_url,
        instagram_url = EXCLUDED.instagram_url,
        youtube_url = EXCLUDED.youtube_url,
        is_public = EXCLUDED.is_public,
        is_verified = EXCLUDED.is_verified,
        updated_at = NOW()
      RETURNING id, user_id as "userId", handle,
                display_name as "displayName", bio,
                avatar_url as "avatarUrl",
                primary_platform as "primaryPlatform",
                tiktok_url as "tiktokUrl",
                instagram_url as "instagramUrl",
                youtube_url as "youtubeUrl",
                is_public as "isPublic",
                is_verified as "isVerified",
                total_approved_videos as "totalApprovedVideos",
                created_at as "createdAt",
                updated_at as "updatedAt"`,
      [
        id,
        data.userId,
        data.handle.trim(),
        data.displayName,
        data.bio ?? null,
        data.avatarUrl ?? null,
        data.primaryPlatform,
        data.tiktokUrl ?? null,
        data.instagramUrl ?? null,
        data.youtubeUrl ?? null,
        data.isPublic,
        data.isVerified ?? false
      ]
    );

    return res.rows[0];
  }

  // Crea un creador independiente, sin cuenta de usuario obligatoria.
  async createCreatorProfile(data: {
    userId?: string | null;
    handle: string;
    displayName: string;
    bio?: string | null;
    avatarUrl?: string | null;
    primaryPlatform: VideoPlatform;
    tiktokUrl?: string | null;
    instagramUrl?: string | null;
    youtubeUrl?: string | null;
    isPublic: boolean;
    isVerified?: boolean;
  }): Promise<CreatorProfile> {
    const id = `cp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const res = await this.pool.query(
      `INSERT INTO creator_profiles (
        id, user_id, handle, display_name, bio, avatar_url,
        primary_platform, tiktok_url, instagram_url, youtube_url,
        is_public, is_verified
      )
      VALUES ($1, $2, LOWER($3), $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, user_id as "userId", handle,
                display_name as "displayName", bio,
                avatar_url as "avatarUrl",
                primary_platform as "primaryPlatform",
                tiktok_url as "tiktokUrl",
                instagram_url as "instagramUrl",
                youtube_url as "youtubeUrl",
                is_public as "isPublic",
                is_verified as "isVerified",
                total_approved_videos as "totalApprovedVideos",
                created_at as "createdAt",
                updated_at as "updatedAt"`,
      [
        id,
        data.userId ?? null,
        data.handle.trim(),
        data.displayName,
        data.bio ?? null,
        data.avatarUrl ?? null,
        data.primaryPlatform,
        data.tiktokUrl ?? null,
        data.instagramUrl ?? null,
        data.youtubeUrl ?? null,
        data.isPublic,
        data.isVerified ?? false
      ]
    );

    return res.rows[0];
  }

  // Actualiza un creador por su ID, nunca por el usuario administrador.
  async updateCreatorProfile(
    id: string,
    data: Partial<{
      userId: string | null;
      handle: string;
      displayName: string;
      bio: string | null;
      avatarUrl: string | null;
      primaryPlatform: VideoPlatform;
      tiktokUrl: string | null;
      instagramUrl: string | null;
      youtubeUrl: string | null;
      isPublic: boolean;
      isVerified: boolean;
    }>
  ): Promise<CreatorProfile | null> {
    const columnMap: Record<string, string> = {
      userId: 'user_id',
      handle: 'handle',
      displayName: 'display_name',
      bio: 'bio',
      avatarUrl: 'avatar_url',
      primaryPlatform: 'primary_platform',
      tiktokUrl: 'tiktok_url',
      instagramUrl: 'instagram_url',
      youtubeUrl: 'youtube_url',
      isPublic: 'is_public',
      isVerified: 'is_verified'
    };

    const params: unknown[] = [];
    const setClauses: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;

      const column = columnMap[key];
      if (!column) continue;

      params.push(key === 'handle' && typeof value === 'string'
        ? value.trim().toLowerCase()
        : value
      );

      setClauses.push(`${column} = $${params.length}`);
    }

    if (setClauses.length === 0) {
      return this.findCreatorProfileById(id);
    }

    setClauses.push('updated_at = NOW()');

    params.push(id);

    const res = await this.pool.query(
      `UPDATE creator_profiles
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, user_id as "userId", handle,
                 display_name as "displayName", bio,
                 avatar_url as "avatarUrl",
                 primary_platform as "primaryPlatform",
                 tiktok_url as "tiktokUrl",
                 instagram_url as "instagramUrl",
                 youtube_url as "youtubeUrl",
                 is_public as "isPublic",
                 is_verified as "isVerified",
                 total_approved_videos as "totalApprovedVideos",
                 created_at as "createdAt",
                 updated_at as "updatedAt"`,
      params
    );

    return res.rows[0] || null;
  }


  async listPublicCreators(): Promise<CreatorProfile[]> {
    const res = await this.pool.query(
      `SELECT id, user_id as "userId", handle, display_name as "displayName", bio, avatar_url as "avatarUrl",
              primary_platform as "primaryPlatform", tiktok_url as "tiktokUrl", instagram_url as "instagramUrl",
              youtube_url as "youtubeUrl", is_public as "isPublic", is_verified as "isVerified",
              total_approved_videos as "totalApprovedVideos", created_at as "createdAt", updated_at as "updatedAt"
       FROM creator_profiles
       WHERE is_public = TRUE
       ORDER BY total_approved_videos DESC, created_at DESC`
    );
    return res.rows;
  }

  async listAllCreators(): Promise<CreatorProfile[]> {
    const res = await this.pool.query(
      `SELECT id, user_id as "userId", handle, display_name as "displayName", bio, avatar_url as "avatarUrl",
              primary_platform as "primaryPlatform", tiktok_url as "tiktokUrl", instagram_url as "instagramUrl",
              youtube_url as "youtubeUrl", is_public as "isPublic", is_verified as "isVerified",
              total_approved_videos as "totalApprovedVideos", created_at as "createdAt", updated_at as "updatedAt"
       FROM creator_profiles
       ORDER BY total_approved_videos DESC, created_at DESC`
    );
    return res.rows;
  }

  async incrementInternalViews(videoId: string): Promise<void> {
    await this.pool.query(
      `UPDATE video_submissions SET internal_views_count = internal_views_count + 1 WHERE id = $1`,
      [videoId]
    );
  }

  async toggleSaveVideo(userId: string, videoId: string): Promise<{ saved: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify that video exists
      const videoCheck = await client.query(
        `SELECT id, status FROM video_submissions WHERE id = $1 FOR UPDATE`,
        [videoId]
      );

      if (videoCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('Video no encontrado');
      }

      const existing = await client.query(
        `SELECT id FROM saved_videos WHERE user_id = $1 AND video_id = $2 FOR UPDATE`,
        [userId, videoId]
      );

      let isSaved: boolean;
      if (existing.rows.length > 0) {
        await client.query(`DELETE FROM saved_videos WHERE user_id = $1 AND video_id = $2`, [userId, videoId]);
        isSaved = false;
      } else {
        const svId = `sv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await client.query(
          `INSERT INTO saved_videos (id, user_id, video_id) VALUES ($1, $2, $3)
           ON CONFLICT (user_id, video_id) DO NOTHING`,
          [svId, userId, videoId]
        );
        isSaved = true;
      }

      // Exact count sync: guarantees counter consistency under concurrency and non-negative counts
      await client.query(
        `UPDATE video_submissions 
         SET internal_saves_count = (SELECT COUNT(*)::int FROM saved_videos WHERE video_id = $1)
         WHERE id = $1`,
        [videoId]
      );

      await client.query('COMMIT');
      return { saved: isSaved };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async isSavedByUser(userId: string, videoId: string): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT 1 FROM saved_videos WHERE user_id = $1 AND video_id = $2 LIMIT 1`,
      [userId, videoId]
    );
    return res.rows.length > 0;
  }

  async listSavedVideosByUser(userId: string): Promise<(VideoSubmission & { places?: Place[] })[]> {
    const res = await this.pool.query(
      `SELECT vs.id, vs.user_id as "userId", vs.creator_profile_id as "creatorProfileId", vs.platform,
              vs.external_video_id as "externalVideoId", vs.video_url as "videoUrl", vs.embed_url as "embedUrl",
              vs.thumbnail_url as "thumbnailUrl", vs.title, vs.description, vs.content_type as "contentType",
              vs.category, vs.locality_id as "localityId", vs.status,
              vs.internal_views_count as "internalViewsCount",
              vs.internal_saves_count as "internalSavesCount", vs.external_metrics as "externalMetrics",
              vs.created_at as "createdAt", vs.updated_at as "updatedAt",
              cp.display_name as "creatorDisplayName",
              cp.handle as "creatorHandle",
              cp.avatar_url as "creatorAvatarUrl"
       FROM saved_videos sv
       INNER JOIN video_submissions vs ON vs.id = sv.video_id
       LEFT JOIN creator_profiles cp ON cp.id = vs.creator_profile_id
       WHERE sv.user_id = $1 AND vs.status = 'APPROVED'
       ORDER BY sv.saved_at DESC`,
      [userId]
    );

    if (res.rows.length === 0) {
      return [];
    }

    const videoIds = res.rows.map((r: { id: string }) => r.id);
    const placesRes = await this.pool.query(
      `SELECT video_id as "videoId", place_id as "placeId", is_primary as "isPrimary"
       FROM video_places
       WHERE video_id = ANY($1)
       ORDER BY is_primary DESC`,
      [videoIds]
    );

    const placesByVideoId: Record<string, Place[]> = {};
    for (const row of placesRes.rows as { videoId: string; placeId: string; isPrimary: boolean }[]) {
      const place = INITIAL_PLACES.find((p) => p.id === row.placeId);
      if (place) {
        if (!placesByVideoId[row.videoId]) {
          placesByVideoId[row.videoId] = [];
        }
        placesByVideoId[row.videoId].push(place);
      }
    }

    return res.rows.map((row: any) => ({
      ...mapVideoSubmissionRow(row),
      places: placesByVideoId[row.id] || [],
    }));
  }

  async getAdminMetrics(): Promise<AdminMetrics> {
    const res = await this.pool.query(`
      SELECT
        COUNT(*)::int as "totalSubmissions",
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::int as "pendingCount",
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END)::int as "approvedCount",
        COUNT(CASE WHEN status = 'OBSERVED' THEN 1 END)::int as "observedCount",
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END)::int as "rejectedCount"
      FROM video_submissions
    `);

    const creatorCountRes = await this.pool.query(`SELECT COUNT(*)::int as count FROM creator_profiles`);

    return {
      totalSubmissions: res.rows[0]?.totalSubmissions || 0,
      pendingCount: res.rows[0]?.pendingCount || 0,
      approvedCount: res.rows[0]?.approvedCount || 0,
      observedCount: res.rows[0]?.observedCount || 0,
      rejectedCount: res.rows[0]?.rejectedCount || 0,
      totalCreators: creatorCountRes.rows[0]?.count || 0,
    };
  }
}
