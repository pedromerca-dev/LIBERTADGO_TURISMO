import { z } from 'zod';

export const PlaceCoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const PlaceImageSchema = z.object({
  id: z.string().default(() => `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
  url: z.string().url(),
  caption: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  isCover: z.boolean().default(false),
});

export const PlaceOpeningHourSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  openTime: z.string(),
  closeTime: z.string(),
  isClosed: z.boolean().default(false),
});

export const PlaceSourceSchema = z.object({
  placeId: z.string().optional(),
  sourceId: z.string(),
  externalId: z.string(),
  rawDataRef: z.string().optional(),
  lastSyncedAt: z.string().optional(),
});

export const PlaceVerificationSchema = z.object({
  isVerified: z.boolean(),
  verificationLevel: z.enum(['unverified', 'community', 'official_mincetur', 'partner_verified']),
  verifiedBy: z.string().optional(),
  verifiedAt: z.string().optional(),
  notes: z.string().optional(),
});

export const CreatePlaceSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  category: z.enum([
    'restaurantes',
    'gastronomia',
    'atractivos',
    'arqueologia',
    'playas',
    'museos',
    'cultura',
    'naturaleza',
    'hoteles',
    'actividades',
  ]),
  subcategory: z.string().optional(),
  localityId: z.string().min(1, 'La localidad es obligatoria'),
  localityName: z.string().min(1, 'El nombre de localidad es obligatorio'),
  address: z.string().min(3, 'La dirección es obligatoria'),
  coordinates: PlaceCoordinatesSchema,
  geohash: z.string().optional(),
  shortDescription: z.string().min(5, 'La descripción corta es requerida'),
  fullDescription: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  mapsUrl: z.string().optional(),
  googlePlaceId: z.string().optional(),
  priceLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewsCount: z.number().min(0).optional(),
  images: z.array(PlaceImageSchema).optional(),
  openingHours: z.array(PlaceOpeningHourSchema).optional(),
  verification: PlaceVerificationSchema.optional(),
  sources: z.array(PlaceSourceSchema).optional(),
  tags: z.array(z.string()).optional(),
  recommendedDurationMinutes: z.number().min(5).optional(),
  safetyScore: z.number().min(0).max(100).optional(),
  status: z.enum(['DRAFT', 'FLAGGED', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
});

export const UpdatePlaceSchema = CreatePlaceSchema.partial();

export const UpdatePlaceStatusSchema = z.object({
  status: z.enum(['DRAFT', 'FLAGGED', 'PUBLISHED', 'ARCHIVED']),
  reason: z.string().optional(),
});

export const VerifyPlaceSchema = z.object({
  isVerified: z.boolean(),
  verificationLevel: z.enum(['unverified', 'community', 'official_mincetur', 'partner_verified']),
  notes: z.string().optional(),
});

export const MergeDuplicatesSchema = z.object({
  primaryId: z.string().min(1, 'primaryId es obligatorio'),
  duplicateIds: z.array(z.string().min(1)).min(1, 'Debe proporcionar al menos un ID duplicado'),
});
