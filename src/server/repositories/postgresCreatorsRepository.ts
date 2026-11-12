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
} from '../../types/creators.ts';
import { Place } from '../../types/catalog.ts';
import { INITIAL_PLACES } from '../../data/initialPlaces.ts';

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
    return res.rows[0] || null;
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
    return res.rows[0] || null;
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
    },
    placeIds: string[] = [],
    primaryPlaceId?: string | null
  ): Promise<VideoSubmission> {
    const id = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const res = await client.query(
        `INSERT INTO video_submissions (
          id, user_id, creator_profile_id, platform, external_video_id,
          video_url, embed_url, thumbnail_url, title, description,
          content_type, category, locality_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PENDING')
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
        ]
      );

      const submission: VideoSubmission = res.rows[0];

      // Associate places
      for (const pId of placeIds) {
        const isPrimary = primaryPlaceId ? primaryPlaceId === pId : placeIds[0] === pId;
        const vpId = `vp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await client.query(
          `INSERT INTO video_places (id, video_id, place_id, is_primary)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (video_id, place_id) DO NOTHING`,
          [vpId, id, pId, isPrimary]
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

  async updateSubmissionStatus(
    id: string,
    status: ModerationStatus,
    notes?: string | null,
    adminUserId?: string
  ): Promise<VideoSubmission | null> {
    const res = await this.pool.query(
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
    return res.rows[0] || null;
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
      ...v,
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
    return res.rows;
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
    return res.rows;
  }

  async addModerationLog(log: {
    videoId: string;
    adminUserId: string;
    adminName: string;
    previousStatus: ModerationStatus;
    newStatus: ModerationStatus;
    reason?: string | null;
    internalNotes?: string | null;
  }): Promise<VideoModerationLog> {
    const id = `mod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const res = await this.pool.query(
      `INSERT INTO video_moderation_logs (id, video_id, admin_user_id, admin_name, previous_status, new_status, reason, internal_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, video_id as "videoId", admin_user_id as "adminUserId", admin_name as "adminName",
                 previous_status as "previousStatus", new_status as "newStatus", reason, internal_notes as "internalNotes",
                 created_at as "createdAt"`,
      [id, log.videoId, log.adminUserId, log.adminName, log.previousStatus, log.newStatus, log.reason || null, log.internalNotes || null]
    );
    return res.rows[0];
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
    return res.rows;
  }

  async associatePlaces(
    videoId: string,
    placeIds: string[],
    primaryPlaceId?: string | null
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM video_places WHERE video_id = $1`, [videoId]);
      for (const pId of placeIds) {
        const isPrimary = primaryPlaceId ? primaryPlaceId === pId : placeIds[0] === pId;
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
      `SELECT place_id as "placeId" FROM video_places WHERE video_id = $1 ORDER BY is_primary DESC`,
      [videoId]
    );
    const placeIds = res.rows.map((r: { placeId: string }) => r.placeId);
    return INITIAL_PLACES.filter((p) => placeIds.includes(p.id));
  }

  async getVideosForPlace(placeId: string): Promise<VideoSubmission[]> {
    const res = await this.pool.query(
      `SELECT vs.id, vs.user_id as "userId", vs.creator_profile_id as "creatorProfileId", vs.platform,
              vs.external_video_id as "externalVideoId", vs.video_url as "videoUrl", vs.embed_url as "embedUrl",
              vs.thumbnail_url as "thumbnailUrl", vs.title, vs.description, vs.content_type as "contentType",
              vs.category, vs.locality_id as "localityId", vs.status, vs.moderation_notes as "moderationNotes",
              vs.moderated_by as "moderatedBy", vs.moderated_at as "moderatedAt", vs.internal_views_count as "internalViewsCount",
              vs.internal_saves_count as "internalSavesCount", vs.external_metrics as "externalMetrics",
              vs.created_at as "createdAt", vs.updated_at as "updatedAt"
       FROM video_submissions vs
       INNER JOIN video_places vp ON vp.video_id = vs.id
       WHERE vp.place_id = $1 AND vs.status = 'APPROVED'
       ORDER BY vs.created_at DESC`,
      [placeId]
    );
    return res.rows;
  }

  async findCreatorProfileByUserId(userId: string): Promise<CreatorProfile | null> {
    const res = await this.pool.query(
      `SELECT id, user_id as "userId", handle, display_name as "displayName", bio, avatar_url as "avatarUrl",
              primary_platform as "primaryPlatform", tiktok_url as "tiktokUrl", instagram_url as "instagramUrl",
              youtube_url as "youtubeUrl", is_public as "isPublic", is_verified as "isVerified",
              total_approved_videos as "totalApprovedVideos", created_at as "createdAt", updated_at as "updatedAt"
       FROM creator_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return res.rows[0] || null;
  }

  async findCreatorProfileByHandle(handle: string): Promise<CreatorProfile | null> {
    const res = await this.pool.query(
      `SELECT id, user_id as "userId", handle, display_name as "displayName", bio, avatar_url as "avatarUrl",
              primary_platform as "primaryPlatform", tiktok_url as "tiktokUrl", instagram_url as "instagramUrl",
              youtube_url as "youtubeUrl", is_public as "isPublic", is_verified as "isVerified",
              total_approved_videos as "totalApprovedVideos", created_at as "createdAt", updated_at as "updatedAt"
       FROM creator_profiles WHERE LOWER(handle) = LOWER($1) LIMIT 1`,
      [handle]
    );
    return res.rows[0] || null;
  }

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
  }): Promise<CreatorProfile> {
    const id = `cp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const res = await this.pool.query(
      `INSERT INTO creator_profiles (
        id, user_id, handle, display_name, bio, avatar_url, primary_platform,
        tiktok_url, instagram_url, youtube_url, is_public
      ) VALUES ($1, $2, LOWER($3), $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id) DO UPDATE SET
        handle = EXCLUDED.handle,
        display_name = EXCLUDED.display_name,
        bio = EXCLUDED.bio,
        avatar_url = EXCLUDED.avatar_url,
        primary_platform = EXCLUDED.primary_platform,
        tiktok_url = EXCLUDED.tiktok_url,
        instagram_url = EXCLUDED.instagram_url,
        youtube_url = EXCLUDED.youtube_url,
        is_public = EXCLUDED.is_public,
        updated_at = NOW()
      RETURNING id, user_id as "userId", handle, display_name as "displayName", bio, avatar_url as "avatarUrl",
                primary_platform as "primaryPlatform", tiktok_url as "tiktokUrl", instagram_url as "instagramUrl",
                youtube_url as "youtubeUrl", is_public as "isPublic", is_verified as "isVerified",
                total_approved_videos as "totalApprovedVideos", created_at as "createdAt", updated_at as "updatedAt"`,
      [
        id,
        data.userId,
        data.handle,
        data.displayName,
        data.bio || null,
        data.avatarUrl || null,
        data.primaryPlatform,
        data.tiktokUrl || null,
        data.instagramUrl || null,
        data.youtubeUrl || null,
        data.isPublic,
      ]
    );
    return res.rows[0];
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

  async incrementInternalViews(videoId: string): Promise<void> {
    await this.pool.query(
      `UPDATE video_submissions SET internal_views_count = internal_views_count + 1 WHERE id = $1`,
      [videoId]
    );
  }

  async toggleSaveVideo(userId: string, videoId: string): Promise<{ saved: boolean }> {
    const existing = await this.pool.query(
      `SELECT id FROM saved_videos WHERE user_id = $1 AND video_id = $2`,
      [userId, videoId]
    );

    if (existing.rows.length > 0) {
      await this.pool.query(`DELETE FROM saved_videos WHERE user_id = $1 AND video_id = $2`, [userId, videoId]);
      await this.pool.query(
        `UPDATE video_submissions SET internal_saves_count = GREATEST(0, internal_saves_count - 1) WHERE id = $1`,
        [videoId]
      );
      return { saved: false };
    } else {
      const svId = `sv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await this.pool.query(`INSERT INTO saved_videos (id, user_id, video_id) VALUES ($1, $2, $3)`, [svId, userId, videoId]);
      await this.pool.query(
        `UPDATE video_submissions SET internal_saves_count = internal_saves_count + 1 WHERE id = $1`,
        [videoId]
      );
      return { saved: true };
    }
  }

  async isSavedByUser(userId: string, videoId: string): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT 1 FROM saved_videos WHERE user_id = $1 AND video_id = $2 LIMIT 1`,
      [userId, videoId]
    );
    return res.rows.length > 0;
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
