/**
 * Place Catalog Repository for LibertadGO
 * Provides unified data access for both PostgreSQL (Neon) and In-Memory Adapter.
 * Pre-seeded with 297 verified places from La Libertad, Peru.
 * Supports CRUD, Status transitions, Verification, Deduplication, Audit Trail, and Dashboard Analytics.
 */

import { INITIAL_PLACES } from '../../data/initialPlaces.ts';
import { Place, PlaceCategory, PlaceVerification, PlaceSource, PlaceImage, PlaceOpeningHours } from '../../types/catalog.ts';
import {
  AdminPlaceRecord,
  PlaceStatus,
  PlaceAuditEntry,
  PlaceAdminFilters,
  DuplicatePair,
  AdminDashboardMetrics,
} from '../../types/adminCatalog.ts';
import { isWithinLaLibertad } from '../../utils/geoBoundary.ts';
import { LA_LIBERTAD_LOCALITIES } from '../../types/geo.ts';
import crypto from 'crypto';

export interface IPlaceRepository {
  listPlaces(filters?: PlaceAdminFilters): Promise<{ places: AdminPlaceRecord[]; total: number; page: number; totalPages: number }>;
  getPlaceById(id: string): Promise<AdminPlaceRecord | null>;
  getPlaceBySlug(slug: string): Promise<AdminPlaceRecord | null>;
  createPlace(data: Partial<AdminPlaceRecord>, adminUserId: string, adminName: string): Promise<AdminPlaceRecord>;
  updatePlace(id: string, data: Partial<AdminPlaceRecord>, adminUserId: string, adminName: string, summary?: string): Promise<AdminPlaceRecord | null>;
  updateStatus(id: string, status: PlaceStatus, adminUserId: string, adminName: string, reason?: string): Promise<AdminPlaceRecord | null>;
  verifyPlace(id: string, isVerified: boolean, level: PlaceVerification['verificationLevel'], notes: string | undefined, adminUserId: string, adminName: string): Promise<AdminPlaceRecord | null>;
  getAuditLogs(placeId?: string, limit?: number): Promise<PlaceAuditEntry[]>;
  findDuplicates(): Promise<DuplicatePair[]>;
  mergeDuplicates(primaryId: string, duplicateIds: string[], adminUserId: string, adminName: string): Promise<{ success: boolean; primaryPlace: AdminPlaceRecord; mergedCount: number }>;
  getCategoriesStats(): Promise<{ category: string; count: number; published: number }[]>;
  getLocalitiesStats(): Promise<{ localityId: string; localityName: string; count: number; published: number }[]>;
  getSourcesStats(): Promise<{ sourceId: string; count: number }[]>;
  getDashboardMetrics(): Promise<AdminDashboardMetrics>;
  getPublicPlaces(filters?: { localityId?: string; category?: string; search?: string }): Promise<Place[]>;
  testConnection?(): Promise<void>;
}

// Distance calculation using Haversine formula (meters)
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
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

  // Word token Jaccard similarity
  const words1 = new Set(s1.split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter((w) => w.length > 2));

  let wordMatches = 0;
  words1.forEach((w) => {
    if (words2.has(w)) wordMatches++;
  });
  const wordUnion = new Set([...words1, ...words2]).size;
  const jaccard = wordUnion > 0 ? wordMatches / wordUnion : 0;

  // Bigram token overlap
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

export class PlaceRepository implements IPlaceRepository {
  private places: Map<string, AdminPlaceRecord> = new Map();
  private auditLogs: PlaceAuditEntry[] = [];

  constructor() {
    this.seedInitialPlaces();
  }

  private seedInitialPlaces(): void {
    const now = new Date().toISOString();
    for (const p of INITIAL_PLACES) {
      if (!isWithinLaLibertad(p.coordinates)) continue;

      const record: AdminPlaceRecord = {
        ...p,
        status: 'PUBLISHED',
        createdBy: 'system_seed',
        updatedBy: 'system_seed',
        createdAt: now,
        updatedAt: now,
      };

      this.places.set(record.id, record);
    }

    // Add initial seed audit log entry
    this.auditLogs.push({
      id: `audit_seed_${Date.now()}`,
      placeId: 'all',
      adminUserId: 'system',
      adminName: 'Sistema LibertadGO',
      action: 'CREATE',
      previousData: null,
      newData: null,
      changeSummary: `Catálogo inicial cargado con ${this.places.size} lugares verificados de La Libertad.`,
      createdAt: now,
    });
  }

  public async listPlaces(filters?: PlaceAdminFilters): Promise<{
    places: AdminPlaceRecord[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    let result = Array.from(this.places.values());

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q) ||
          p.localityName.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (filters?.status && filters.status !== 'ALL') {
      result = result.filter((p) => p.status === filters.status);
    }

    if (filters?.category && filters.category !== 'todas') {
      const cat = filters.category.toLowerCase();
      result = result.filter((p) => p.category.toLowerCase() === cat);
    }

    if (filters?.localityId && filters.localityId !== 'todas') {
      const locId = filters.localityId.toLowerCase();
      result = result.filter((p) => p.localityId.toLowerCase() === locId);
    }

    if (filters?.isVerified !== undefined && filters.isVerified !== 'ALL') {
      const target = Boolean(filters.isVerified);
      result = result.filter((p) => p.verification.isVerified === target);
    }

    // Sorting
    const sortBy = filters?.sortBy || 'updatedAt';
    const sortOrder = filters?.sortOrder || 'desc';

    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'rating') {
        comparison = (a.rating || 0) - (b.rating || 0);
      } else if (sortBy === 'reviewsCount') {
        comparison = (a.reviewsCount || 0) - (b.reviewsCount || 0);
      } else if (sortBy === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        // updatedAt
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    const total = result.length;
    const page = Math.max(1, filters?.page || 1);
    const limit = Math.max(1, Math.min(500, filters?.limit || 20));
    const startIndex = (page - 1) * limit;
    const paginated = result.slice(startIndex, startIndex + limit);

    return {
      places: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async getPlaceById(id: string): Promise<AdminPlaceRecord | null> {
    return this.places.get(id) || null;
  }

  public async getPlaceBySlug(slug: string): Promise<AdminPlaceRecord | null> {
    for (const p of this.places.values()) {
      if (p.slug === slug) return p;
    }
    return null;
  }

  public async createPlace(
    data: Partial<AdminPlaceRecord>,
    adminUserId: string,
    adminName: string
  ): Promise<AdminPlaceRecord> {
    const id = data.id || `place_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const baseSlug = (data.name || 'nuevo-lugar')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    let counter = 1;
    while (Array.from(this.places.values()).some((p) => p.slug === slug)) {
      slug = `${baseSlug}-${counter++}`;
    }

    const now = new Date().toISOString();

    const record: AdminPlaceRecord = {
      id,
      slug: data.slug || slug,
      name: data.name || 'Nuevo Lugar Turístico',
      category: data.category || 'atractivos',
      subcategory: data.subcategory || '',
      localityId: data.localityId || 'trujillo',
      localityName: data.localityName || 'Trujillo',
      address: data.address || 'Trujillo, La Libertad',
      coordinates: data.coordinates || { lat: -8.1118, lng: -79.0287 },
      geohash: data.geohash || '',
      shortDescription: data.shortDescription || '',
      fullDescription: data.fullDescription || '',
      phone: data.phone || '',
      email: data.email || '',
      website: data.website || '',
      mapsUrl: data.mapsUrl || '',
      googlePlaceId: data.googlePlaceId || '',
      priceLevel: data.priceLevel || 2,
      rating: data.rating !== undefined ? data.rating : 4.5,
      reviewsCount: data.reviewsCount || 0,
      images: Array.isArray(data.images) && data.images.length > 0 ? data.images : [
        {
          id: `img_${Date.now()}`,
          url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
          caption: data.name || 'Lugar turístico',
          isCover: true,
        },
      ],
      openingHours: data.openingHours || [],
      verification: data.verification || {
        isVerified: true,
        verificationLevel: 'partner_verified',
        verifiedBy: adminName,
        verifiedAt: now,
      },
      sources: data.sources || [
        {
          placeId: id,
          sourceId: 'panel_admin_libertadgo',
          externalId: id,
          lastSyncedAt: now,
        },
      ],
      tags: Array.isArray(data.tags) ? data.tags : ['turismo', 'la-libertad'],
      recommendedDurationMinutes: data.recommendedDurationMinutes || 60,
      safetyScore: data.safetyScore !== undefined ? data.safetyScore : 85,
      safetyReport: data.safetyReport,
      predictionScore: data.predictionScore,
      status: data.status || 'PUBLISHED',
      createdBy: adminUserId,
      updatedBy: adminUserId,
      createdAt: now,
      updatedAt: now,
    };

    this.places.set(id, record);

    this.auditLogs.unshift({
      id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      placeId: id,
      adminUserId,
      adminName,
      action: 'CREATE',
      previousData: null,
      newData: record,
      changeSummary: `Creado nuevo lugar: "${record.name}" (${record.category}, ${record.localityName}) con estado ${record.status}.`,
      createdAt: now,
    });

    return record;
  }

  public async updatePlace(
    id: string,
    data: Partial<AdminPlaceRecord>,
    adminUserId: string,
    adminName: string,
    summary?: string
  ): Promise<AdminPlaceRecord | null> {
    const existing = this.places.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: AdminPlaceRecord = {
      ...existing,
      ...data,
      id: existing.id, // prevent ID change
      updatedBy: adminUserId,
      updatedAt: now,
    };

    this.places.set(id, updated);

    this.auditLogs.unshift({
      id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      placeId: id,
      adminUserId,
      adminName,
      action: 'UPDATE',
      previousData: existing,
      newData: updated,
      changeSummary: summary || `Actualizados datos de "${updated.name}" por ${adminName}.`,
      createdAt: now,
    });

    return updated;
  }

  public async updateStatus(
    id: string,
    status: PlaceStatus,
    adminUserId: string,
    adminName: string,
    reason?: string
  ): Promise<AdminPlaceRecord | null> {
    const existing = this.places.get(id);
    if (!existing) return null;

    const previousStatus = existing.status;
    const now = new Date().toISOString();

    const updated: AdminPlaceRecord = {
      ...existing,
      status,
      updatedBy: adminUserId,
      updatedAt: now,
    };

    this.places.set(id, updated);

    this.auditLogs.unshift({
      id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      placeId: id,
      adminUserId,
      adminName,
      action: status === 'ARCHIVED' ? 'ARCHIVE' : 'STATUS_CHANGE',
      previousData: { status: previousStatus },
      newData: { status },
      changeSummary: `Cambio de estado en "${existing.name}": de ${previousStatus} a ${status}.${reason ? ` Motivo: ${reason}` : ''}`,
      createdAt: now,
    });

    return updated;
  }

  public async verifyPlace(
    id: string,
    isVerified: boolean,
    level: PlaceVerification['verificationLevel'],
    notes: string | undefined,
    adminUserId: string,
    adminName: string
  ): Promise<AdminPlaceRecord | null> {
    const existing = this.places.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const prevVerification = existing.verification;

    const updatedVerification: PlaceVerification = {
      isVerified,
      verificationLevel: level,
      verifiedBy: isVerified ? adminName : undefined,
      verifiedAt: isVerified ? now : undefined,
      notes: notes || undefined,
    };

    const updated: AdminPlaceRecord = {
      ...existing,
      verification: updatedVerification,
      updatedBy: adminUserId,
      updatedAt: now,
    };

    this.places.set(id, updated);

    this.auditLogs.unshift({
      id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      placeId: id,
      adminUserId,
      adminName,
      action: 'VERIFY',
      previousData: { verification: prevVerification },
      newData: { verification: updatedVerification },
      changeSummary: `${isVerified ? 'Verificado' : 'Desverificado'} "${existing.name}" (Nivel: ${level}).${notes ? ` Notas: ${notes}` : ''}`,
      createdAt: now,
    });

    return updated;
  }

  public async getAuditLogs(placeId?: string, limit: number = 50): Promise<PlaceAuditEntry[]> {
    if (!placeId || placeId === 'all') {
      return this.auditLogs.slice(0, limit);
    }
    return this.auditLogs.filter((log) => log.placeId === placeId).slice(0, limit);
  }

  public async findDuplicates(): Promise<DuplicatePair[]> {
    const all = Array.from(this.places.values()).filter((p) => p.status !== 'ARCHIVED');
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

        // Check if external source IDs match
        const p1ExternalIds = new Set(p1.sources.map((s) => `${s.sourceId}:${s.externalId}`));
        const sharesExternalId = p2.sources.some((s) => p1ExternalIds.has(`${s.sourceId}:${s.externalId}`));

        const reasons: string[] = [];

        if (sharesExternalId) {
          reasons.push('Coincidencia exacta de identificador externo de fuente');
        }
        if (nameSimilarity > 0.85) {
          reasons.push(`Nombres casi idénticos (${Math.round(nameSimilarity * 100)}% similitud)`);
        } else if (nameSimilarity > 0.65 && distanceMeters < 300) {
          reasons.push(`Nombres similares (${Math.round(nameSimilarity * 100)}%) y proximidad (${distanceMeters}m)`);
        }
        if (distanceMeters < 150 && sameCategory && sameLocality) {
          reasons.push(`Distancia física muy cercana (${distanceMeters}m) en la misma localidad y categoría`);
        }

        // Criterion for duplicate suggestion
        const isDuplicateCandidate =
          sharesExternalId ||
          (nameSimilarity > 0.82 && distanceMeters < 1500) ||
          (nameSimilarity > 0.60 && distanceMeters < 150);

        if (isDuplicateCandidate && reasons.length > 0) {
          seen.add(pairKey);
          // Prioritize verified or more complete place as primary
          const p1Score = (p1.verification.isVerified ? 10 : 0) + (p1.images.length * 2) + (p1.reviewsCount || 0);
          const p2Score = (p2.verification.isVerified ? 10 : 0) + (p2.images.length * 2) + (p2.reviewsCount || 0);

          const primary = p1Score >= p2Score ? p1 : p2;
          const duplicate = p1Score >= p2Score ? p2 : p1;

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

  public async mergeDuplicates(
    primaryId: string,
    duplicateIds: string[],
    adminUserId: string,
    adminName: string
  ): Promise<{ success: boolean; primaryPlace: AdminPlaceRecord; mergedCount: number }> {
    const primary = this.places.get(primaryId);
    if (!primary) {
      throw new Error(`Lugar principal ${primaryId} no encontrado`);
    }

    let mergedCount = 0;
    const now = new Date().toISOString();

    const mergedImages = [...primary.images];
    const mergedSources = [...primary.sources];
    const mergedTags = new Set(primary.tags);

    for (const dupId of duplicateIds) {
      if (dupId === primaryId) continue;
      const dup = this.places.get(dupId);
      if (!dup) continue;

      // Merge non-duplicate images
      for (const img of dup.images) {
        if (!mergedImages.some((existingImg) => existingImg.url === img.url)) {
          mergedImages.push({
            ...img,
            id: `img_merged_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            isCover: false,
          });
        }
      }

      // Merge sources
      for (const src of dup.sources) {
        if (!mergedSources.some((s) => s.sourceId === src.sourceId && s.externalId === src.externalId)) {
          mergedSources.push(src);
        }
      }

      // Merge tags
      for (const t of dup.tags) {
        mergedTags.add(t);
      }

      // Archive duplicate place rather than destructively deleting
      const archivedDup: AdminPlaceRecord = {
        ...dup,
        status: 'ARCHIVED',
        updatedBy: adminUserId,
        updatedAt: now,
      };
      this.places.set(dupId, archivedDup);

      this.auditLogs.unshift({
        id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        placeId: dupId,
        adminUserId,
        adminName,
        action: 'ARCHIVE',
        previousData: { status: dup.status },
        newData: { status: 'ARCHIVED' },
        changeSummary: `Lugar archivado por fusión de duplicados hacia el lugar principal "${primary.name}" (${primary.id}).`,
        createdAt: now,
      });

      mergedCount++;
    }

    const updatedPrimary: AdminPlaceRecord = {
      ...primary,
      images: mergedImages,
      sources: mergedSources,
      tags: Array.from(mergedTags),
      updatedBy: adminUserId,
      updatedAt: now,
    };

    this.places.set(primaryId, updatedPrimary);

    this.auditLogs.unshift({
      id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      placeId: primaryId,
      adminUserId,
      adminName,
      action: 'MERGE',
      previousData: primary,
      newData: updatedPrimary,
      changeSummary: `Fusión exitosa: se integraron datos de ${mergedCount} lugar(es) duplicado(s) archivado(s).`,
      createdAt: now,
    });

    return {
      success: true,
      primaryPlace: updatedPrimary,
      mergedCount,
    };
  }

  public async getCategoriesStats(): Promise<{ category: string; count: number; published: number }[]> {
    const counts: Record<string, { total: number; published: number }> = {};
    for (const p of this.places.values()) {
      if (!counts[p.category]) counts[p.category] = { total: 0, published: 0 };
      counts[p.category].total++;
      if (p.status === 'PUBLISHED') counts[p.category].published++;
    }

    return Object.entries(counts).map(([category, { total, published }]) => ({
      category,
      count: total,
      published,
    }));
  }

  public async getLocalitiesStats(): Promise<{ localityId: string; localityName: string; count: number; published: number }[]> {
    const counts: Record<string, { name: string; total: number; published: number }> = {};

    for (const loc of LA_LIBERTAD_LOCALITIES) {
      counts[loc.id] = { name: loc.name, total: 0, published: 0 };
    }

    for (const p of this.places.values()) {
      if (!counts[p.localityId]) {
        counts[p.localityId] = { name: p.localityName, total: 0, published: 0 };
      }
      counts[p.localityId].total++;
      if (p.status === 'PUBLISHED') counts[p.localityId].published++;
    }

    return Object.entries(counts).map(([localityId, { name, total, published }]) => ({
      localityId,
      localityName: name,
      count: total,
      published,
    }));
  }

  public async getSourcesStats(): Promise<{ sourceId: string; count: number }[]> {
    const counts: Record<string, number> = {};
    for (const p of this.places.values()) {
      for (const s of p.sources) {
        counts[s.sourceId] = (counts[s.sourceId] || 0) + 1;
      }
    }
    return Object.entries(counts).map(([sourceId, count]) => ({ sourceId, count }));
  }

  public async getDashboardMetrics(): Promise<AdminDashboardMetrics> {
    const all = Array.from(this.places.values());
    let published = 0;
    let draft = 0;
    let flagged = 0;
    let archived = 0;
    let verified = 0;

    for (const p of all) {
      if (p.status === 'PUBLISHED') published++;
      else if (p.status === 'DRAFT') draft++;
      else if (p.status === 'FLAGGED') flagged++;
      else if (p.status === 'ARCHIVED') archived++;

      if (p.verification.isVerified) verified++;
    }

    const duplicates = await this.findDuplicates();
    const categoriesStats = await this.getCategoriesStats();
    const localitiesStats = await this.getLocalitiesStats();
    const sourcesStats = await this.getSourcesStats();
    const recentAuditLogs = await this.getAuditLogs('all', 12);

    return {
      totalPlaces: all.length,
      publishedCount: published,
      draftCount: draft,
      flaggedCount: flagged,
      archivedCount: archived,
      verifiedCount: verified,
      unverifiedCount: all.length - verified,
      placesByCategory: categoriesStats,
      placesByLocality: localitiesStats,
      sourcesDistribution: sourcesStats,
      potentialDuplicatesCount: duplicates.length,
      recentAuditLogs,
    };
  }

  public async getPublicPlaces(filters?: { localityId?: string; category?: string; search?: string }): Promise<Place[]> {
    // For public users, only show PUBLISHED places
    let result = Array.from(this.places.values()).filter((p) => p.status === 'PUBLISHED');

    if (filters?.localityId && filters.localityId !== 'todas') {
      const locId = filters.localityId.toLowerCase().trim();
      result = result.filter((p) => p.localityId.toLowerCase() === locId);
    }

    if (filters?.category && filters.category !== 'todas') {
      const cat = filters.category.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.category.toLowerCase() === cat ||
          (p.subcategory && p.subcategory.toLowerCase().includes(cat))
      );
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result.filter((p) => isWithinLaLibertad(p.coordinates));
  }
}

let placeRepositoryInstance: IPlaceRepository | null = null;

export function getPlaceRepository(): IPlaceRepository {
  if (!placeRepositoryInstance) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[Storage Architecture] FATAL: Place repository is not initialized with PostgreSQL in production environment.'
      );
    }
    placeRepositoryInstance = new PlaceRepository();
  }
  return placeRepositoryInstance!;
}

export function setPlaceRepositoryInstance(repo: IPlaceRepository | null): void {
  placeRepositoryInstance = repo;
}

export function resetPlaceRepositoryForTesting(): void {
  placeRepositoryInstance = new PlaceRepository();
}
