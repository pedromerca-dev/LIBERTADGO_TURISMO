/**
 * Repository Interfaces for LibertadGO Creators & Auth Modules
 * Strict separation of concerns to allow seamless switching between PostgreSQL and testing adapters.
 */

import {
  User,
  CreatorProfile,
  VideoSubmission,
  VideoModerationLog,
  VideoPlatform,
  ModerationStatus,
} from '../../types/creators.ts';
import { Place } from '../../types/catalog.ts';

export interface VideoFilterOptions {
  localityId?: string;
  category?: string;
  contentType?: string;
  platform?: string;
  q?: string;
  placeId?: string;
  page?: number;
  limit?: number;
}

export interface AdminMetrics {
  totalSubmissions: number;
  pendingCount: number;
  approvedCount: number;
  observedCount: number;
  rejectedCount: number;
  totalCreators: number;
}

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  createUser(data: {
    email: string;
    passwordHash: string;
    name: string;
    role?: 'USER' | 'ADMIN';
    avatarUrl?: string | null;
  }): Promise<User>;
  countUsers(): Promise<number>;
  listUsers(): Promise<Omit<User, 'passwordHash'>[]>;
}

export interface ICreatorsRepository {
  // Video Submissions
  findSubmissionById(id: string): Promise<VideoSubmission | null>;
  findSubmissionByPlatformAndExternalId(
    platform: VideoPlatform,
    externalVideoId: string
  ): Promise<VideoSubmission | null>;
  createSubmission(
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
    },
    placeIds?: string[],
    primaryPlaceId?: string | null
  ): Promise<VideoSubmission>;
  updateSubmission(
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
    }>,
    placeIds?: string[],
    primaryPlaceId?: string | null
  ): Promise<VideoSubmission | null>;
  updateSubmissionStatus(
    id: string,
    status: ModerationStatus,
    notes?: string | null,
    adminUserId?: string
  ): Promise<VideoSubmission | null>;
  listApprovedVideos(
    filters?: VideoFilterOptions
  ): Promise<{ videos: (VideoSubmission & { places: Place[] })[]; total: number }>;
  listSubmissionsByUser(userId: string): Promise<VideoSubmission[]>;
  listModerationQueue(status?: ModerationStatus): Promise<VideoSubmission[]>;

  // Moderation & Audit
  addModerationLog(log: {
    videoId: string;
    adminUserId: string;
    adminName: string;
    previousStatus: ModerationStatus;
    newStatus: ModerationStatus;
    reason?: string | null;
    internalNotes?: string | null;
  }): Promise<VideoModerationLog>;
  getModerationLogs(videoId: string): Promise<VideoModerationLog[]>;

  // Places Association (N:M with Place)
  associatePlaces(
    videoId: string,
    placeIds: string[],
    primaryPlaceId?: string | null
  ): Promise<void>;
  getPlacesForVideo(videoId: string): Promise<Place[]>;
  getVideosForPlace(placeId: string): Promise<VideoSubmission[]>;

  // Creator Profiles
  findCreatorProfileByUserId(userId: string): Promise<CreatorProfile | null>;
  findCreatorProfileByHandle(handle: string): Promise<CreatorProfile | null>;
  saveCreatorProfile(data: {
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
  }): Promise<CreatorProfile>;
  listPublicCreators(): Promise<CreatorProfile[]>;
  listAllCreators(): Promise<CreatorProfile[]>;

  // Metrics & Engagement
  incrementInternalViews(videoId: string): Promise<void>;
  toggleSaveVideo(userId: string, videoId: string): Promise<{ saved: boolean }>;
  isSavedByUser(userId: string, videoId: string): Promise<boolean>;
  getAdminMetrics(): Promise<AdminMetrics>;
}
