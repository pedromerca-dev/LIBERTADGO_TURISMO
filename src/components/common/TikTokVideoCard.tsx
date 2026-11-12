import React from 'react';
import { Play, Video } from 'lucide-react';

interface TikTokVideoCardProps {
  videoUrl: string;
  title: string;
  creator: string;
  creatorAvatarUrl?: string;
  placeName?: string;
  thumbnailUrl?: string;
  category?: string;
  platform?: string;
}

export function TikTokVideoCard({
  videoUrl,
  title,
  creator,
  creatorAvatarUrl,
  placeName,
  thumbnailUrl,
  category = 'Video turístico',
  platform = 'tiktok',
}: TikTokVideoCardProps) {
  const platformLabel =
    platform === 'youtube' ? 'YouTube' : platform === 'instagram' ? 'Instagram' : 'TikTok';

  const cleanCreator = creator.trim() || 'Creador de contenido';
  const creatorInitials = cleanCreator.replace(/^@/, '').slice(0, 2).toUpperCase() || 'CR';

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-900">
        {/* Prioridad 1: Miniatura oficial del video */}
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : creatorAvatarUrl ? (
          /* Prioridad 2: Identidad visual del creador original con avatar */
          <div className="relative flex h-full w-full flex-col items-center justify-center p-3 text-white overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
            {/* Ambient blur background */}
            <div
              className="absolute inset-0 opacity-20 blur-xl scale-150"
              style={{ backgroundImage: `url(${creatorAvatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
            <div className="relative z-10 flex flex-col items-center text-center gap-1.5 max-w-[90%]">
              <div className="relative">
                <img
                  src={creatorAvatarUrl}
                  alt={cleanCreator}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/80 shadow-md"
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px] border border-white/40 shadow-xs">
                  <Play className="w-2 h-2 fill-white" />
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate max-w-[150px]">
                  {cleanCreator}
                </span>
                <span className="text-[10px] text-white/70 block">
                  Publicación en {platformLabel}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Prioridad 3: Fondo neutral estilizado de Wayra con identidad textual */
          <div className="relative flex h-full w-full flex-col items-center justify-center p-3 text-white overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-[#17243A]">
            <div className="relative z-10 flex flex-col items-center text-center gap-1.5">
              <div className="w-11 h-11 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold text-white shadow-xs">
                {creatorInitials}
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-200 block truncate max-w-[150px]">
                  {cleanCreator}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Video en {platformLabel}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Categoría sutil sobre la imagen */}
        <span className="absolute left-2.5 top-2.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
          {category}
        </span>

        {/* Distintivo de plataforma */}
        <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
          {platformLabel}
        </span>
      </div>

      <div className="space-y-2.5 p-3 flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <h3 className="line-clamp-2 text-xs font-semibold text-slate-900 leading-snug">
            {title}
          </h3>
          <p className="text-[11px] font-medium text-slate-500 truncate">
            {cleanCreator}
          </p>

          {placeName && (
            <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
              <span aria-hidden="true">📍</span>
              <span>{placeName}</span>
            </p>
          )}
        </div>

        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 shadow-2xs"
        >
          <span>Ver en {platformLabel}</span>
          <span aria-hidden="true" className="text-[10px]">↗</span>
        </a>
      </div>
    </article>
  );
}
