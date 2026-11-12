/**
 * Domain Models for LibertadGO - Creators Module
 * Technical Foundations: Users, Authentication, Creator Profiles,
 * Video Submissions, Places Association (N:M), Moderation Logs, Reports & Bookmarks.
 */

export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  avatarUrl?: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type UserPublic = Omit<User, 'passwordHash'>;

export type VideoPlatform = 'tiktok' | 'instagram' | 'youtube';

export type VideoContentType = 'PLACE' | 'ROUTE' | 'GENERAL';

export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'OBSERVED' | 'HIDDEN';

export interface CreatorProfile {
  id: string;
  userId: string;
  handle: string;                       // Unique handle, e.g. "trujillofoodie"
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  primaryPlatform: VideoPlatform;
  tiktokUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  isPublic: boolean;                    // Creator profiles are optional and can be private/public
  isVerified: boolean;
  totalApprovedVideos: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoExternalMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  recordedAt?: string;
  creatorHandle?: string | null;
  creatorDisplayName?: string | null;
  creatorAvatarUrl?: string | null;
}

export interface VideoSubmission {
  id: string;
  userId: string;
  creatorProfileId?: string | null;
  platform: VideoPlatform;
  externalVideoId: string;              // Canonical unique ID extracted from the platform URL (e.g. 7192837482)
  videoUrl: string;                     // Canonical clean URL of the original post
  embedUrl: string;                     // Official safe playback URL (youtube-nocookie, tiktok embed, ig embed)
  thumbnailUrl: string | null;          // Explicitly nullable
  title: string;
  description?: string | null;
  contentType: VideoContentType;
  category: string;                     // Must align with PlaceCategory or regional tourist topics
  localityId?: string | null;           // Regional boundary (La Libertad) e.g. "trujillo", "huanchaco"
  status: ModerationStatus;
  moderationNotes?: string | null;      // Feedback for the user if OBSERVED or REJECTED
  moderatedBy?: string | null;
  moderatedAt?: string | null;
  // Metrics separation: Internal platform metrics vs external platform statistics
  internalViewsCount: number;           // Times played/viewed within LibertadGO
  internalSavesCount: number;           // Times bookmarked by users within LibertadGO
  externalMetrics?: VideoExternalMetrics | null; // Real external social metrics if provided by verified creator
  // External creator identity when creatorProfileId is NULL
  externalCreatorHandle?: string | null;
  externalCreatorDisplayName?: string | null;
  externalCreatorAvatarUrl?: string | null;
  // Creator enrichment (joined from creator_profiles and users)
  creatorDisplayName?: string | null;
  creatorHandle?: string | null;
  creatorAvatarUrl?: string | null;
  userName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoPlace {
  id: string;
  videoId: string;
  placeId: string;                      // Foreign key referencing Place.id from existing tourist directory
  isPrimary: boolean;                   // Indicates main featured establishment
  notes?: string | null;                // Context note (e.g. "Minuto 0:45 degustación de seco")
  createdAt: string;
}

export type ModerationActionType = 'CREATE' | 'UPDATE' | 'APPROVE' | 'REJECT' | 'OBSERVE' | 'HIDE';

export interface ModerationAuditPayload {
  adminUserId: string;
  adminName: string;
  action: ModerationActionType;
  previousStatus?: ModerationStatus | null;
  newStatus: ModerationStatus;
  reason?: string | null;
  internalNotes?: string | null;
  changedFields?: string[] | null;
}

export interface VideoModerationLog {
  id: string;
  videoId: string;
  adminUserId: string;
  adminName: string;
  action: ModerationActionType;
  previousStatus: ModerationStatus | null;
  newStatus: ModerationStatus;
  reason?: string | null;
  internalNotes?: string | null;
  changedFields?: string[] | null;
  createdAt: string;
}

export interface SavedVideo {
  id: string;
  userId: string;
  videoId: string;
  savedAt: string;
}

export interface VideoReport {
  id: string;
  videoId: string;
  reportedByUserId: string;
  reason: 'broken_link' | 'inappropriate' | 'wrong_location' | 'spam' | 'other';
  details?: string | null;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
}

export interface VideoCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
}
