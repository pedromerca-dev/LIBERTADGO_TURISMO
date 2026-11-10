import { Place, PlaceCategory, PlaceVerification, PlaceSource, PlaceImage, PlaceOpeningHours } from './catalog.ts';

export type PlaceStatus = 'DRAFT' | 'FLAGGED' | 'PUBLISHED' | 'ARCHIVED';

export interface AdminPlaceRecord extends Place {
  status: PlaceStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceAuditEntry {
  id: string;
  placeId: string;
  adminUserId: string;
  adminName: string;
  action: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'VERIFY' | 'MERGE' | 'ARCHIVE';
  previousData?: Partial<AdminPlaceRecord> | null;
  newData?: Partial<AdminPlaceRecord> | null;
  changeSummary: string;
  createdAt: string;
}

export interface PlaceAdminFilters {
  search?: string;
  status?: PlaceStatus | 'ALL';
  category?: PlaceCategory | 'todas';
  localityId?: string | 'todas';
  isVerified?: boolean | 'ALL';
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'updatedAt' | 'createdAt' | 'rating' | 'reviewsCount';
  sortOrder?: 'asc' | 'desc';
}

export interface DuplicatePair {
  id: string;
  primaryPlace: AdminPlaceRecord;
  duplicatePlace: AdminPlaceRecord;
  similarityScore: number; // 0 to 1
  distanceMeters: number;
  reasons: string[];
}

export interface AdminDashboardMetrics {
  totalPlaces: number;
  publishedCount: number;
  draftCount: number;
  flaggedCount: number;
  archivedCount: number;
  verifiedCount: number;
  unverifiedCount: number;
  placesByCategory: { category: string; count: number; published: number }[];
  placesByLocality: { localityId: string; localityName: string; count: number; published: number }[];
  sourcesDistribution: { sourceId: string; count: number }[];
  potentialDuplicatesCount: number;
  recentAuditLogs: PlaceAuditEntry[];
}
