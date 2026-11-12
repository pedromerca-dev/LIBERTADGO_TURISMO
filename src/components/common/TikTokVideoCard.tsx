import React from 'react';
import { Play, MapPin, CheckCircle2 } from 'lucide-react';

export interface TikTokVideoCardProps {
  videoUrl: string;
  title: string;
  creator: string;
  creatorHandle?: string;
  creatorAvatarUrl?: string;
  placeName?: string;
  thumbnailUrl?: string;
  category?: string;
  platform?: string;
  publishedDate?: string;
  isApproved?: boolean;
}

/**
 * TikTok Video Card — Clean, media-focused UI inspired by TikTok simplicity.
 * Displays only:
 * - Video thumbnail / preview
 * - Title of the video
 * - Creator handle & platform (e.g. @creador · TikTok)
 * - Associated place
 * - Original publication date (if available)
 * - Approved content indicator
 * - Direct action: "Ver en TikTok"
 */
export function TikTokVideoCard({
  videoUrl,
  title,
  creator,
  creatorHandle,
  creatorAvatarUrl,
  placeName,
  thumbnailUrl,
  platform = 'tiktok',
  publishedDate,
  isApproved = true,
}: TikTokVideoCardProps) {
  const platformLabel =
    platform === 'youtube' ? 'YouTube' : platform === 'instagram' ? 'Instagram' : 'TikTok';

  // Format creator and handle
  const cleanCreator = creator.trim() || 'Creador de contenido';
  const handleDisplay = creatorHandle
    ? (creatorHandle.startsWith('@') ? creatorHandle : `@${creatorHandle}`)
    : (cleanCreator.startsWith('@') ? cleanCreator : `@${cleanCreator.toLowerCase().replace(/\s+/g, '_')}`);
  const creatorInitials = handleDisplay.replace(/^@/, '').slice(0, 2).toUpperCase() || 'CR';

  return (
    <article className="group overflow-hidden rounded-lg border border-[#E9E7E1] bg-white transition-colors hover:border-slate-300 flex flex-col justify-between">
      {/* Visual media preview container */}
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-900">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : creatorAvatarUrl ? (
          <div className="relative flex h-full w-full flex-col items-center justify-center p-3 text-white overflow-hidden bg-slate-800">
            <img
              src={creatorAvatarUrl}
              alt={cleanCreator}
              className="w-12 h-12 rounded-full object-cover border border-white/40 shadow-sm"
            />
            <span className="text-xs font-medium text-white/90 mt-1 truncate max-w-[140px]">
              {handleDisplay}
            </span>
          </div>
        ) : (
          <div className="relative flex h-full w-full flex-col items-center justify-center p-3 text-white bg-slate-800">
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-semibold text-white">
              {creatorInitials}
            </div>
            <span className="text-xs font-medium text-slate-300 mt-1 truncate max-w-[140px]">
              {handleDisplay}
            </span>
          </div>
        )}

        {/* Play indicator */}
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-9 h-9 rounded-full bg-white/90 text-[#263B35] flex items-center justify-center shadow-sm">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>

        {/* Platform badge */}
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {platformLabel}
        </span>
      </div>

      {/* Video Content Information */}
      <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
        <div className="space-y-1">
          {/* Title */}
          <h3 className="line-clamp-2 text-xs font-semibold text-[#263B35] leading-snug">
            {title}
          </h3>

          {/* @creator · Platform */}
          <p className="text-[11px] text-[#64748B] truncate">
            <span className="font-medium text-[#263B35]">{handleDisplay}</span>
            <span> · {platformLabel}</span>
          </p>

          {/* Associated place */}
          {placeName && (
            <p className="text-[11px] text-[#64748B] flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-[#E85B49] shrink-0" />
              <span>{placeName}</span>
            </p>
          )}

          {/* Original publication date when available */}
          {publishedDate && (
            <p className="text-[10px] text-slate-500">
              Publicado: {publishedDate}
            </p>
          )}

          {/* Content Approved */}
          {isApproved && (
            <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 pt-0.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Contenido aprobado</span>
            </p>
          )}
        </div>

        {/* Action: Open original content */}
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-center py-1.5 px-3 rounded-md bg-[#263B35] text-white hover:bg-[#E85B49] text-xs font-medium transition-colors block cursor-pointer"
        >
          Ver en {platformLabel}
        </a>
      </div>
    </article>
  );
}
