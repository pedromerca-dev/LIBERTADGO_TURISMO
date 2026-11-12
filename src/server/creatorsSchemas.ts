/**
 * Zod Validation Schemas for LibertadGO Creators Module & Auth
 */

import { z } from 'zod';
import { LA_LIBERTAD_LOCALITIES } from '../types/geo.ts';
import { parseAndValidateVideoUrl } from '../utils/videoUrlParser.ts';

const validLocalityIds = new Set(LA_LIBERTAD_LOCALITIES.map((l) => l.id));

export const RegisterUserSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('El correo electrónico no es válido'),
  password: z
    .string()
    .min(8, 'La contraseña debe contener al menos 8 caracteres')
    .max(100, 'La contraseña no puede exceder 100 caracteres'),
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre no puede exceder 80 caracteres'),
});

export const LoginUserSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('El correo electrónico no es válido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida'),
});

export const CreatorProfileSchema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, 'El handle solo puede contener letras minúsculas, números y guiones bajos (3-30 caracteres)'),
  displayName: z
    .string()
    .trim()
    .min(2, 'El nombre visible debe tener al menos 2 caracteres')
    .max(60, 'El nombre visible no puede exceder 60 caracteres'),
  bio: z
    .string()
    .trim()
    .max(300, 'La biografía no puede exceder 300 caracteres')
    .optional()
    .nullable(),
  avatarUrl: z
    .string()
    .url('La URL del avatar no es válida')
    .optional()
    .nullable(),
  primaryPlatform: z.enum(['tiktok', 'instagram', 'youtube']),
  tiktokUrl: z.string().url().optional().nullable(),
  instagramUrl: z.string().url().optional().nullable(),
  youtubeUrl: z.string().url().optional().nullable(),
  isPublic: z.boolean().default(true),
});

export const SubmitVideoSchema = z.object({
  videoUrl: z
    .string()
    .trim()
    .url('La URL del video debe ser un enlace válido')
    .refine((url) => parseAndValidateVideoUrl(url).isValid, {
      message: 'La URL debe corresponder a un video válido de TikTok, Instagram o YouTube',
    }),
  title: z
    .string()
    .trim()
    .min(5, 'El título debe tener al menos 5 caracteres')
    .max(140, 'El título no puede exceder 140 caracteres'),
  description: z
    .string()
    .trim()
    .max(1000, 'La descripción no puede exceder 1000 caracteres')
    .optional()
    .nullable(),
  contentType: z.enum(['PLACE', 'ROUTE', 'GENERAL']),
  category: z
    .string()
    .trim()
    .min(2, 'La categoría es requerida'),
  localityId: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .nullable()
    .refine((locId) => !locId || validLocalityIds.has(locId), {
      message: 'La localidad especificada debe pertenecer a la región La Libertad',
    }),
  thumbnailUrl: z
    .string()
    .trim()
    .url('La URL de la miniatura debe ser válida')
    .optional()
    .nullable(),
  placeIds: z
    .array(z.string().trim())
    .max(10, 'No puedes vincular más de 10 lugares por video')
    .default([]),
  primaryPlaceId: z
    .string()
    .trim()
    .optional()
    .nullable(),
}).refine(
  (data) => {
    if (data.primaryPlaceId && data.placeIds) {
      return data.placeIds.includes(data.primaryPlaceId);
    }
    return true;
  },
  {
    message: 'El lugar principal (primaryPlaceId) debe pertenecer a la lista de lugares asociados (placeIds)',
    path: ['primaryPlaceId'],
  }
);

export const ModerationActionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'OBSERVE', 'HIDE']),
  reason: z
    .string()
    .trim()
    .max(500, 'El motivo no puede exceder 500 caracteres')
    .optional()
    .nullable(),
  internalNotes: z
    .string()
    .trim()
    .max(500, 'Las notas internas no pueden exceder 500 caracteres')
    .optional()
    .nullable(),
  verifiedPlaceIds: z
    .array(z.string().trim())
    .optional(),
});

export const AdminCreateVideoSchema = z.object({
  videoUrl: z
    .string()
    .trim()
    .url('La URL del video debe ser un enlace válido')
    .refine((url) => parseAndValidateVideoUrl(url).isValid, {
      message: 'La URL debe corresponder a un video válido de TikTok, Instagram o YouTube',
    }),
  title: z
    .string()
    .trim()
    .min(5, 'El título debe tener al menos 5 caracteres')
    .max(140, 'El título no puede exceder 140 caracteres'),
  description: z
    .string()
    .trim()
    .max(1000, 'La descripción no puede exceder 1000 caracteres')
    .optional()
    .nullable(),
  contentType: z.enum(['PLACE', 'ROUTE', 'GENERAL']).default('PLACE'),
  category: z
    .string()
    .trim()
    .min(2, 'La categoría es requerida'),
  localityId: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .nullable()
    .refine((locId) => !locId || validLocalityIds.has(locId), {
      message: 'La localidad especificada debe pertenecer a la región La Libertad',
    }),
  thumbnailUrl: z
    .string()
    .trim()
    .url('La URL de la miniatura debe ser válida')
    .optional()
    .nullable(),
  creatorProfileId: z
    .string()
    .trim()
    .optional()
    .nullable(),
  placeIds: z
    .array(z.string().trim())
    .max(10, 'No puedes vincular más de 10 lugares por video')
    .default([]),
  primaryPlaceId: z
    .string()
    .trim()
    .optional()
    .nullable(),
  status: z.enum(['PENDING', 'APPROVED']).default('APPROVED'),
  externalCreatorHandle: z
    .string()
    .trim()
    .max(100, 'El handle no puede exceder 100 caracteres')
    .optional()
    .nullable(),
  externalCreatorDisplayName: z
    .string()
    .trim()
    .max(150, 'El nombre no puede exceder 150 caracteres')
    .optional()
    .nullable(),
  externalCreatorAvatarUrl: z
    .string()
    .trim()
    .url('La URL del avatar no es válida')
    .optional()
    .nullable(),
}).refine(
  (data) => {
    if (data.primaryPlaceId && data.placeIds) {
      return data.placeIds.includes(data.primaryPlaceId);
    }
    return true;
  },
  {
    message: 'El lugar principal (primaryPlaceId) debe pertenecer a la lista de lugares asociados (placeIds)',
    path: ['primaryPlaceId'],
  }
);

export const AdminUpdateVideoSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'El título debe tener al menos 5 caracteres')
    .max(140, 'El título no puede exceder 140 caracteres')
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, 'La descripción no puede exceder 1000 caracteres')
    .optional()
    .nullable(),
  contentType: z.enum(['PLACE', 'ROUTE', 'GENERAL']).optional(),
  category: z
    .string()
    .trim()
    .min(2, 'La categoría es requerida')
    .optional(),
  localityId: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .nullable()
    .refine((locId) => !locId || validLocalityIds.has(locId), {
      message: 'La localidad especificada debe pertenecer a la región La Libertad',
    }),
  thumbnailUrl: z
    .string()
    .trim()
    .url('La URL de la miniatura debe ser válida')
    .optional()
    .nullable(),
  creatorProfileId: z
    .string()
    .trim()
    .optional()
    .nullable(),
  placeIds: z
    .array(z.string().trim())
    .max(10, 'No puedes vincular más de 10 lugares por video')
    .optional(),
  primaryPlaceId: z
    .string()
    .trim()
    .optional()
    .nullable(),
  status: z.enum(['PENDING', 'APPROVED', 'OBSERVED', 'REJECTED', 'HIDDEN']).optional(),
  externalCreatorHandle: z
    .string()
    .trim()
    .max(100, 'El handle no puede exceder 100 caracteres')
    .optional()
    .nullable(),
  externalCreatorDisplayName: z
    .string()
    .trim()
    .max(150, 'El nombre no puede exceder 150 caracteres')
    .optional()
    .nullable(),
  externalCreatorAvatarUrl: z
    .string()
    .trim()
    .url('La URL del avatar no es válida')
    .optional()
    .nullable(),
}).refine(
  (data) => {
    if (data.primaryPlaceId && data.placeIds) {
      return data.placeIds.includes(data.primaryPlaceId);
    }
    return true;
  },
  {
    message: 'El lugar principal (primaryPlaceId) debe pertenecer a la lista de lugares asociados (placeIds)',
    path: ['primaryPlaceId'],
  }
);

export const AdminCreateCreatorSchema = z.object({
  userId: z.string().trim().optional(),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, 'El handle solo puede contener minúsculas, números y guiones bajos (3-30 caracteres)'),
  displayName: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(60, 'El nombre no puede exceder 60 caracteres'),
  bio: z.string().trim().max(300).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  primaryPlatform: z.enum(['tiktok', 'instagram', 'youtube']),
  tiktokUrl: z.string().url().optional().nullable(),
  instagramUrl: z.string().url().optional().nullable(),
  youtubeUrl: z.string().url().optional().nullable(),
  isPublic: z.boolean().default(true),
  isVerified: z.boolean().default(false),
});
