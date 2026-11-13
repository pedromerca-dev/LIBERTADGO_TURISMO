/**
 * Memory Adapter Implementation of IAuthRepository and ICreatorsRepository
 * Used in local development or test suites when PostgreSQL (DATABASE_URL) is not provisioned.
 * Implements the exact same interface contracts, relationships, and constraints.
 */

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
  VideoPlace,
  SavedVideo,
  VideoExternalMetrics,
} from '../../types/creators.ts';
import { Place } from '../../types/catalog.ts';
import { INITIAL_PLACES } from '../../data/initialPlaces.ts';

export class MemoryCreatorsRepository implements IAuthRepository, ICreatorsRepository {
  private users: Map<string, User> = new Map();
  private creatorProfiles: Map<string, CreatorProfile> = new Map(); // key: creatorProfileId
  private videoSubmissions: Map<string, VideoSubmission> = new Map();
  private videoPlaces: Map<string, VideoPlace> = new Map();
  private moderationLogs: VideoModerationLog[] = [];
  private savedVideos: Map<string, SavedVideo> = new Map(); // key: `${userId}_${videoId}`

  // --- IAuthRepository ---

  async findUserByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return { ...user };
      }
    }
    return null;
  }

  async findUserById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    name: string;
    role?: 'USER' | 'ADMIN';
    avatarUrl?: string | null;
  }): Promise<User> {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newUser: User = {
      id,
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      name: data.name,
      avatarUrl: data.avatarUrl || null,
      role: data.role || 'USER',
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, newUser);
    return { ...newUser };
  }

  async countUsers(): Promise<number> {
    return this.users.size;
  }

  async listUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    return Array.from(this.users.values()).map(({ passwordHash, ...rest }) => ({ ...rest }));
  }

  // --- ICreatorsRepository ---

  async findSubmissionById(id: string): Promise<VideoSubmission | null> {
    const sub = this.videoSubmissions.get(id);
    return sub ? { ...sub } : null;
  }

  async findSubmissionByPlatformAndExternalId(
    platform: VideoPlatform,
    externalVideoId: string
  ): Promise<VideoSubmission | null> {
    for (const sub of this.videoSubmissions.values()) {
      if (sub.platform === platform && sub.externalVideoId === externalVideoId) {
        return { ...sub };
      }
    }
    return null;
  }

  async createSubmission(
    data: {
      userId: string ;
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
    if (
      data.creatorProfileId &&
      !this.creatorProfiles.has(data.creatorProfileId)
    ) {
      throw new Error('El perfil del creador no existe');
    }
    const id = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const submission: VideoSubmission = {
      ...data,
      id,
      creatorProfileId: data.creatorProfileId || null,
      thumbnailUrl: data.thumbnailUrl || null,
      description: data.description || null,
      localityId: data.localityId || null,
      status: data.status || 'PENDING',
      externalCreatorHandle: data.externalCreatorHandle || null,
      externalCreatorDisplayName: data.externalCreatorDisplayName || null,
      externalCreatorAvatarUrl: data.externalCreatorAvatarUrl || null,
      moderationNotes: null,
      moderatedBy: data.status === 'APPROVED' ? data.userId : null,
      moderatedAt: data.status === 'APPROVED' ? now : null,
      internalViewsCount: 0,
      internalSavesCount: 0,
      externalMetrics: data.externalCreatorHandle || data.externalCreatorDisplayName ? {
        creatorHandle: data.externalCreatorHandle,
        creatorDisplayName: data.externalCreatorDisplayName,
        creatorAvatarUrl: data.externalCreatorAvatarUrl,
      } : null,
      createdAt: now,
      updatedAt: now,
    };

    // Validate primaryPlaceId upfront before mutating state
    const uniquePlaceIds = Array.from(new Set(placeIds || []));
    if (primaryPlaceId && uniquePlaceIds.length > 0 && !uniquePlaceIds.includes(primaryPlaceId)) {
      throw new Error('primaryPlaceId must be one of the associated placeIds');
    }

    this.videoSubmissions.set(id, submission);

    // Associate places
    if (uniquePlaceIds.length > 0) {
      await this.associatePlaces(id, uniquePlaceIds, primaryPlaceId);
    }

    if (audit) {
      await this.addModerationLog({
        videoId: id,
        adminUserId: audit.adminUserId,
        adminName: audit.adminName,
        action: audit.action || 'CREATE',
        previousStatus: audit.previousStatus ?? null,
        newStatus: audit.newStatus,
        reason: audit.reason || null,
        internalNotes: audit.internalNotes || null,
        changedFields: audit.changedFields || null,
      });
    }

    return { ...submission };
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
    const sub = this.videoSubmissions.get(id);
    if (!sub) return null;
        // Validar que el nuevo perfil del creador exista
        if (
          data.creatorProfileId !== undefined &&
          data.creatorProfileId !== null &&
          !this.creatorProfiles.has(data.creatorProfileId)
        ) {
          throw new Error('El perfil del creador no existe');
        }

    // Validate primaryPlaceId against placeIds or existing places before mutating
    if (placeIds !== undefined) {
      const uniqueIds = Array.from(new Set(placeIds));
      if (primaryPlaceId !== undefined && primaryPlaceId !== null) {
        if (uniqueIds.length > 0 && !uniqueIds.includes(primaryPlaceId)) {
          throw new Error('primaryPlaceId must be one of the associated placeIds');
        }
      }
    } else if (primaryPlaceId !== undefined && primaryPlaceId !== null) {
      const currentPlaces = await this.getPlacesForVideo(id);
      if (!currentPlaces.some((p) => p.id === primaryPlaceId)) {
        throw new Error('primaryPlaceId must be one of the associated placeIds');
      }
    }

    const updated: VideoSubmission = {
      ...sub,
      title: data.title ?? sub.title,
      description: data.description !== undefined ? data.description : sub.description,
      contentType: data.contentType ?? sub.contentType,
      category: data.category ?? sub.category,
      localityId: data.localityId !== undefined ? data.localityId : sub.localityId,
      thumbnailUrl: data.thumbnailUrl !== undefined ? data.thumbnailUrl : sub.thumbnailUrl,
      creatorProfileId: data.creatorProfileId !== undefined ? data.creatorProfileId : sub.creatorProfileId,
      status: data.status ?? sub.status,
      externalCreatorHandle: data.externalCreatorHandle !== undefined ? data.externalCreatorHandle : sub.externalCreatorHandle,
      externalCreatorDisplayName: data.externalCreatorDisplayName !== undefined ? data.externalCreatorDisplayName : sub.externalCreatorDisplayName,
      externalCreatorAvatarUrl: data.externalCreatorAvatarUrl !== undefined ? data.externalCreatorAvatarUrl : sub.externalCreatorAvatarUrl,
      externalMetrics:
        data.externalCreatorHandle !== undefined ||
        data.externalCreatorDisplayName !== undefined ||
        data.externalCreatorAvatarUrl !== undefined ||
        data.externalMetrics !== undefined
          ? {
              ...(sub.externalMetrics || {}),
              ...(data.externalMetrics !== undefined ? data.externalMetrics : {}),
              ...(data.externalCreatorHandle !== undefined ? { creatorHandle: data.externalCreatorHandle } : {}),
              ...(data.externalCreatorDisplayName !== undefined ? { creatorDisplayName: data.externalCreatorDisplayName } : {}),
              ...(data.externalCreatorAvatarUrl !== undefined ? { creatorAvatarUrl: data.externalCreatorAvatarUrl } : {}),
            }
          : sub.externalMetrics,
      updatedAt: new Date().toISOString(),
    };

    this.videoSubmissions.set(id, updated);

    if (placeIds !== undefined && Array.isArray(placeIds)) {
      const uniquePlaceIds = Array.from(new Set(placeIds));
      let effectivePrimaryId: string | null = null;

      if (primaryPlaceId !== undefined && primaryPlaceId !== null) {
        effectivePrimaryId = primaryPlaceId;
      } else {
        // Find existing primary place
        const currentPlaces = Array.from(this.videoPlaces.values()).filter((vp) => vp.videoId === id);
        const existingPrimary = currentPlaces.find((vp) => vp.isPrimary)?.placeId;
        if (existingPrimary && uniquePlaceIds.includes(existingPrimary)) {
          effectivePrimaryId = existingPrimary;
        } else {
          effectivePrimaryId = uniquePlaceIds.length > 0 ? uniquePlaceIds[0] : null;
        }
      }

      await this.associatePlaces(id, uniquePlaceIds, effectivePrimaryId);
    } else if (primaryPlaceId !== undefined && primaryPlaceId !== null) {
      for (const vp of this.videoPlaces.values()) {
        if (vp.videoId === id) {
          vp.isPrimary = vp.placeId === primaryPlaceId;
        }
      }
    }

    if (audit) {
      await this.addModerationLog({
        videoId: id,
        adminUserId: audit.adminUserId,
        adminName: audit.adminName,
        action: audit.action || 'UPDATE',
        previousStatus: audit.previousStatus ?? sub.status,
        newStatus: audit.newStatus ?? (data.status ?? sub.status),
        reason: audit.reason || null,
        internalNotes: audit.internalNotes || null,
        changedFields: audit.changedFields || null,
      });
    }

    return { ...updated };
  }

  async updateSubmissionStatus(
    id: string,
    status: ModerationStatus,
    notes?: string | null,
    adminUserId?: string,
    audit?: ModerationAuditPayload,
    placeIds?: string[]
  ): Promise<VideoSubmission | null> {
    const sub = this.videoSubmissions.get(id);
    if (!sub) return null;

    const prevStatus = sub.status;
    const updated: VideoSubmission = {
      ...sub,
      status,
      moderationNotes: notes || null,
      moderatedBy: adminUserId || null,
      moderatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.videoSubmissions.set(id, updated);

    if (placeIds && Array.isArray(placeIds)) {
      await this.associatePlaces(id, placeIds);
    }

    if (audit) {
      await this.addModerationLog({
        videoId: id,
        adminUserId: audit.adminUserId,
        adminName: audit.adminName,
        action: audit.action || (status === 'APPROVED' ? 'APPROVE' : status === 'REJECTED' ? 'REJECT' : status === 'OBSERVED' ? 'OBSERVE' : status === 'HIDDEN' ? 'HIDE' : 'UPDATE'),
        previousStatus: audit.previousStatus ?? prevStatus,
        newStatus: audit.newStatus ?? status,
        reason: audit.reason || null,
        internalNotes: audit.internalNotes || notes || null,
        changedFields: audit.changedFields || null,
      });
    }

    return { ...updated };
  }

  async listApprovedVideos(
    filters: VideoFilterOptions = {}
  ): Promise<{ videos: (VideoSubmission & { places: Place[] })[]; total: number }> {
    let list = Array.from(this.videoSubmissions.values()).filter(
      (v) => v.status === 'APPROVED'
    );

    if (filters.localityId && filters.localityId !== 'todas') {
      const loc = filters.localityId.toLowerCase();
      list = list.filter((v) => v.localityId?.toLowerCase() === loc);
    }

    if (filters.category && filters.category !== 'todas') {
      const cat = filters.category.toLowerCase();
      list = list.filter((v) => v.category.toLowerCase() === cat);
    }

    if (filters.contentType) {
      list = list.filter((v) => v.contentType === filters.contentType);
    }

    if (filters.platform) {
      list = list.filter((v) => v.platform === filters.platform);
    }

    if (filters.q) {
      const q = filters.q.toLowerCase().trim();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          (v.description && v.description.toLowerCase().includes(q))
      );
    }

    if (filters.placeId) {
      const placeId = filters.placeId;
      const matchingVideoIds = new Set(
        Array.from(this.videoPlaces.values())
          .filter((vp) => vp.placeId === placeId)
          .map((vp) => vp.videoId)
      );
      list = list.filter((v) => matchingVideoIds.has(v.id));
    }

    // Sort newest first
    list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = list.length;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 20));
    const start = (page - 1) * limit;
    const paginated = list.slice(start, start + limit);

    const videosWithPlaces = await Promise.all(
      paginated.map(async (v) => {
        const places = await this.getPlacesForVideo(v.id);
        const creatorProfile = v.creatorProfileId
        ? this.creatorProfiles.get(v.creatorProfileId) || null
        : null;
        const user = this.users.get(v.userId);

        return {
          ...v,
          creatorDisplayName: creatorProfile?.displayName || null,
          creatorHandle: creatorProfile?.handle || null,
          creatorAvatarUrl: creatorProfile?.avatarUrl || null,
          tiktokFollowers: creatorProfile?.tiktokFollowers ?? null,
          instagramFollowers: creatorProfile?.instagramFollowers ?? null,
          youtubeSubscribers: creatorProfile?.youtubeSubscribers ?? null,
          audienceUpdatedAt: creatorProfile?.audienceUpdatedAt ?? null,
          externalCreatorHandle: v.externalCreatorHandle || (v.externalMetrics as any)?.creatorHandle || null,
          externalCreatorDisplayName: v.externalCreatorDisplayName || (v.externalMetrics as any)?.creatorDisplayName || null,
          externalCreatorAvatarUrl: v.externalCreatorAvatarUrl || (v.externalMetrics as any)?.creatorAvatarUrl || null,
          userName: user?.name || null,
          places,
        };
      })
    );

    return { videos: videosWithPlaces, total };
  }

  async listSubmissionsByUser(userId: string): Promise<VideoSubmission[]> {
    const list = Array.from(this.videoSubmissions.values())
      .filter((v) => v.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    return list.map((v) => ({ ...v }));
  }

 async listSubmissionsByCreatorProfileId(
  creatorProfileId: string
): Promise<VideoSubmission[]> {
  const list = Array.from(this.videoSubmissions.values())
    .filter(
      (video) => video.creatorProfileId === creatorProfileId
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );

  return list.map((video) => ({ ...video }));
}

  async listModerationQueue(
    status: ModerationStatus = 'PENDING'
  ): Promise<VideoSubmission[]> {
    const list = Array.from(this.videoSubmissions.values())
      .filter((v) => v.status === status)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    return list.map((v) => ({ ...v }));
  }

  async addModerationLog(log: {
    videoId: string;
    adminUserId: string;
    adminName: string;
    action?: ModerationActionType;
    previousStatus?: ModerationStatus | null;
    newStatus: ModerationStatus;
    reason?: string | null;
    internalNotes?: string | null;
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
    const newLog: VideoModerationLog = {
      id,
      videoId: log.videoId,
      adminUserId: log.adminUserId,
      adminName: log.adminName,
      action,
      previousStatus: log.previousStatus === undefined ? null : log.previousStatus,
      newStatus: log.newStatus,
      reason: log.reason || null,
      internalNotes: log.internalNotes || null,
      changedFields: log.changedFields || null,
      createdAt: new Date().toISOString(),
    };
    this.moderationLogs.unshift(newLog);
    return { ...newLog };
  }

  async getModerationLogs(videoId: string): Promise<VideoModerationLog[]> {
    return this.moderationLogs
      .filter((l) => l.videoId === videoId)
      .map((l) => ({ ...l }));
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

    // Remove previous associations
    for (const [k, vp] of this.videoPlaces.entries()) {
      if (vp.videoId === videoId) {
        this.videoPlaces.delete(k);
      }
    }

    uniquePlaceIds.forEach((pId) => {
      const isPrimary = effectivePrimaryId === pId;
      const id = `vp_${videoId}_${pId}`;
      this.videoPlaces.set(id, {
        id,
        videoId,
        placeId: pId,
        isPrimary,
        createdAt: new Date().toISOString(),
      });
    });
  }

  async getPlacesForVideo(videoId: string): Promise<Place[]> {
    const pIds = Array.from(this.videoPlaces.values())
      .filter((vp) => vp.videoId === videoId)
      .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
      .map((vp) => vp.placeId);

    return pIds
      .map((id) => INITIAL_PLACES.find((p) => p.id === id))
      .filter((p): p is Place => p !== undefined);
  }

  async getPlacesForVideos(videoIds: string[]): Promise<Record<string, Place[]>> {
    const map: Record<string, Place[]> = {};
    for (const id of videoIds) {
      map[id] = await this.getPlacesForVideo(id);
    }
    return map;
  }

  async getVideosForPlace(placeId: string): Promise<VideoSubmission[]> {
    const videoIds = new Set(
      Array.from(this.videoPlaces.values())
        .filter((vp) => vp.placeId === placeId)
        .map((vp) => vp.videoId)
    );

    const matching = Array.from(this.videoSubmissions.values())
      .filter((v) => videoIds.has(v.id) && v.status === 'APPROVED')
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    return Promise.all(
      matching.map(async (v) => {
        const places = await this.getPlacesForVideo(v.id);
        const creatorProfile = v.creatorProfileId
        ? this.creatorProfiles.get(v.creatorProfileId) || null
         : null;
        const user = this.users.get(v.userId);

        return {
          ...v,
          creatorDisplayName: creatorProfile?.displayName || null,
          creatorHandle: creatorProfile?.handle || null,
          creatorAvatarUrl: creatorProfile?.avatarUrl || null,
          tiktokFollowers: creatorProfile?.tiktokFollowers ?? null,
          instagramFollowers: creatorProfile?.instagramFollowers ?? null,
          youtubeSubscribers: creatorProfile?.youtubeSubscribers ?? null,
          audienceUpdatedAt: creatorProfile?.audienceUpdatedAt ?? null,
          externalCreatorHandle: v.externalCreatorHandle || (v.externalMetrics as any)?.creatorHandle || null,
          externalCreatorDisplayName: v.externalCreatorDisplayName || (v.externalMetrics as any)?.creatorDisplayName || null,
          externalCreatorAvatarUrl: v.externalCreatorAvatarUrl || (v.externalMetrics as any)?.creatorAvatarUrl || null,
          userName: user?.name || null,
          places,
        };
      })
    );
  }

  async findCreatorProfileByUserId(userId: string): Promise<CreatorProfile | null> {
    const profile = Array.from(this.creatorProfiles.values())
      .find((item) => item.userId === userId);

    return profile ? { ...profile } : null;
  }

  async findCreatorProfileById(id: string): Promise<CreatorProfile | null> {
    const profile = this.creatorProfiles.get(id);
    return profile ? { ...profile } : null;
  }

  async findCreatorProfileByHandle(handle: string): Promise<CreatorProfile | null> {
    const normalizedHandle = handle.toLowerCase().trim();

    const profile = Array.from(this.creatorProfiles.values())
      .find((item) => item.handle.toLowerCase() === normalizedHandle);

    return profile ? { ...profile } : null;
  }

  // Crear o actualizar un perfil vinculado a una cuenta de usuario.
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
    tiktokFollowers?: number | null;
    instagramFollowers?: number | null;
    youtubeSubscribers?: number | null;
    audienceUpdatedAt?: string | null;
    isPublic: boolean;
    isVerified?: boolean;
  }): Promise<CreatorProfile> {
    const existing = Array.from(this.creatorProfiles.values())
      .find((profile) => profile.userId === data.userId);

    const profile = await this.createOrUpdateProfile(
      existing?.id ?? null,
      data
    );

    return profile;
  }

  // Crear un perfil independiente, sin exigir una cuenta de usuario.
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
    tiktokFollowers?: number | null;
    instagramFollowers?: number | null;
    youtubeSubscribers?: number | null;
    audienceUpdatedAt?: string | null;
    isPublic: boolean;
    isVerified?: boolean;
  }): Promise<CreatorProfile> {
    return this.createOrUpdateProfile(null, data);
  }

  // Actualizar un perfil existente mediante su ID.
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
      tiktokFollowers: number | null;
      instagramFollowers: number | null;
      youtubeSubscribers: number | null;
      audienceUpdatedAt: string | null;
      isPublic: boolean;
      isVerified: boolean;
    }>
  ): Promise<CreatorProfile | null> {
    const existing = this.creatorProfiles.get(id);

    if (!existing) return null;

    return this.createOrUpdateProfile(id, {
      ...existing,
      ...data,
    });
  }

  // Método interno para centralizar validaciones y persistencia.
  private async createOrUpdateProfile(
    existingId: string | null,
    data: {
      userId?: string | null;
      handle: string;
      displayName: string;
      bio?: string | null;
      avatarUrl?: string | null;
      primaryPlatform: VideoPlatform;
      tiktokUrl?: string | null;
      instagramUrl?: string | null;
      youtubeUrl?: string | null;
      tiktokFollowers?: number | null;
      instagramFollowers?: number | null;
      youtubeSubscribers?: number | null;
      audienceUpdatedAt?: string | null;
      isPublic: boolean;
      isVerified?: boolean;
    }
  ): Promise<CreatorProfile> {
    const normalizedHandle = data.handle.toLowerCase().trim();

    if (!normalizedHandle) {
      throw new Error('El handle del creador es obligatorio');
    }

    const duplicateHandle = Array.from(this.creatorProfiles.values())
      .find((profile) =>
        profile.handle.toLowerCase() === normalizedHandle &&
        profile.id !== existingId
      );

    if (duplicateHandle) {
      throw new Error('Ya existe un creador con ese handle');
    }

    if (data.userId) {
      const duplicateUser = Array.from(this.creatorProfiles.values())
        .find((profile) =>
          profile.userId === data.userId &&
          profile.id !== existingId
        );

      if (duplicateUser) {
        throw new Error('Este usuario ya tiene un perfil de creador');
      }
    }

    const existing = existingId
      ? this.creatorProfiles.get(existingId)
      : undefined;

    const now = new Date().toISOString();

    const profile: CreatorProfile = {
      id: existing?.id ??
        `cp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: data.userId ?? null,
      handle: normalizedHandle,
      displayName: data.displayName,
      bio: data.bio ?? null,
      avatarUrl: data.avatarUrl ?? null,
      primaryPlatform: data.primaryPlatform,
      tiktokUrl: data.tiktokUrl ?? null,
      instagramUrl: data.instagramUrl ?? null,
      youtubeUrl: data.youtubeUrl ?? null,
      tiktokFollowers: data.tiktokFollowers ?? null,
      instagramFollowers: data.instagramFollowers ?? null,
      youtubeSubscribers: data.youtubeSubscribers ?? null,
      audienceUpdatedAt: data.audienceUpdatedAt ?? null,
      isPublic: data.isPublic,
      isVerified: data.isVerified ?? existing?.isVerified ?? false,
      totalApprovedVideos: existing?.totalApprovedVideos ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.creatorProfiles.set(profile.id, profile);

    return { ...profile };
  }


  async listPublicCreators(): Promise<CreatorProfile[]> {
    return Array.from(this.creatorProfiles.values())
      .filter((c) => c.isPublic)
      .sort((a, b) => b.totalApprovedVideos - a.totalApprovedVideos);
  }

  async listAllCreators(): Promise<CreatorProfile[]> {
    return Array.from(this.creatorProfiles.values())
      .sort((a, b) => b.totalApprovedVideos - a.totalApprovedVideos);
  }

  async incrementInternalViews(videoId: string): Promise<void> {
    const sub = this.videoSubmissions.get(videoId);
    if (sub) {
      sub.internalViewsCount += 1;
    }
  }

  async toggleSaveVideo(userId: string, videoId: string): Promise<{ saved: boolean }> {
    const sub = this.videoSubmissions.get(videoId);
    if (!sub) {
      throw new Error('Video no encontrado');
    }
    const key = `${userId}_${videoId}`;

    let isSaved: boolean;
    if (this.savedVideos.has(key)) {
      this.savedVideos.delete(key);
      isSaved = false;
    } else {
      this.savedVideos.set(key, {
        id: `sv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId,
        videoId,
        savedAt: new Date().toISOString(),
      });
      isSaved = true;
    }

    // Exact count sync: guarantees counter consistency and prevents drift/negatives
    let actualCount = 0;
    for (const sv of this.savedVideos.values()) {
      if (sv.videoId === videoId) actualCount++;
    }
    sub.internalSavesCount = actualCount;

    return { saved: isSaved };
  }

  async isSavedByUser(userId: string, videoId: string): Promise<boolean> {
    return this.savedVideos.has(`${userId}_${videoId}`);
  }

  async listSavedVideosByUser(userId: string): Promise<(VideoSubmission & { places?: Place[] })[]> {
    const userSaved = Array.from(this.savedVideos.values())
      .filter((sv) => sv.userId === userId)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

    const result: (VideoSubmission & { places?: Place[] })[] = [];
    for (const sv of userSaved) {
      const sub = this.videoSubmissions.get(sv.videoId);
      if (sub && sub.status === 'APPROVED') {
        const places = await this.getPlacesForVideo(sub.id);
        const creatorProfile = sub.creatorProfileId
         ? this.creatorProfiles.get(sub.creatorProfileId) || null
         : null;

        result.push({
          ...sub,
          creatorDisplayName: creatorProfile?.displayName || null,
          creatorHandle: creatorProfile?.handle || null,
          creatorAvatarUrl: creatorProfile?.avatarUrl || null,
          places,
        });
      }
    }

    return result;
  }

  async getAdminMetrics(): Promise<AdminMetrics> {
    const subs = Array.from(this.videoSubmissions.values());
    return {
      totalSubmissions: subs.length,
      pendingCount: subs.filter((s) => s.status === 'PENDING').length,
      approvedCount: subs.filter((s) => s.status === 'APPROVED').length,
      observedCount: subs.filter((s) => s.status === 'OBSERVED').length,
      rejectedCount: subs.filter((s) => s.status === 'REJECTED').length,
      totalCreators: this.creatorProfiles.size,
    };
  }

  async testConnection(): Promise<void> {
    // Memory adapter is always connected in development
    return Promise.resolve();
  }

  async close(): Promise<void> {
    this.users.clear();
    this.creatorProfiles.clear();
    this.videoSubmissions.clear();
    this.videoPlaces.clear();
    this.savedVideos.clear();
    this.moderationLogs = [];
    return Promise.resolve();
  }
}
