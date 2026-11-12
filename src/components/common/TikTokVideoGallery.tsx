
import React, { useMemo, useState } from 'react';
import { TikTokVideoCard } from './TikTokVideoCard';
import { Eye, Heart, Clock, TrendingUp, Bookmark, Play } from 'lucide-react';
import { FILTER_CATEGORIES } from '../../utils/filterUtils';

export interface TikTokVideo {
  id: string;
  videoUrl: string;
  title: string;
  creator: string;
  placeName: string;
  category: string;
  thumbnailUrl?: string;
  views?: number;
  likes?: number;
  rating?: number;
  updatedAt?: string;
  demo?: boolean;
  locality?: string;
  department?: string;
  externalViews?: number | null;
  externalLikes?: number | null;
  externalComments?: number | null;
  internalViews?: number;
  internalSaves?: number;
  platform?: string;
  embedUrl?: string;
  places?: Array<{ id: string; name: string; locality?: string }>;
  rawDate?: string;
}

interface TikTokVideoGalleryProps {
  videos: TikTokVideo[];
  title?: string;
  description?: string;
  showFilters?: boolean;
  showSearch?: boolean;
  compact?: boolean;
  showCount?: boolean;
  onClearFilters?: () => void;
}

const VIDEO_CATEGORIES = FILTER_CATEGORIES.map(category => category.label);

const SORT_OPTIONS = [
  { id: 'popular', label: 'Más vistos en TikTok' },
  { id: 'likes', label: 'Más likes' },
  { id: 'app_views', label: 'Más vistos en app' },
  { id: 'recent', label: 'Más recientes' },
];

export function TikTokVideoGallery({
  videos,
  title = 'Videos turísticos',
  description = 'Descubre destinos y experiencias a través de sus creadores.',
  showFilters = true,
  showSearch = true,
  compact = false,
  showCount = true,
  onClearFilters,
}: TikTokVideoGalleryProps) {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [sortBy, setSortBy] = useState('popular');
  const [search, setSearch] = useState('');

  const filteredVideos = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return videos
      .filter(video => {
        const matchesCategory =
          activeCategory === 'Todos' ||
          video.category.toLowerCase() === activeCategory.toLowerCase();

        const matchesSearch =
          !normalizedSearch ||
          video.title.toLowerCase().includes(normalizedSearch) ||
          video.creator.toLowerCase().includes(normalizedSearch) ||
          video.placeName.toLowerCase().includes(normalizedSearch);

        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'likes': {
            const likesB = b.externalLikes ?? b.likes ?? 0;
            const likesA = a.externalLikes ?? a.likes ?? 0;
            return likesB - likesA;
          }
          case 'app_views': {
            const viewsB = b.internalViews ?? 0;
            const viewsA = a.internalViews ?? 0;
            return viewsB - viewsA;
          }
          case 'recent': {
            const timeB = b.rawDate ? new Date(b.rawDate).getTime() : new Date(b.updatedAt || 0).getTime();
            const timeA = a.rawDate ? new Date(a.rawDate).getTime() : new Date(a.updatedAt || 0).getTime();
            return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
          }
          case 'popular':
          default: {
            const viewsB = b.externalViews ?? b.views ?? 0;
            const viewsA = a.externalViews ?? a.views ?? 0;
            return viewsB - viewsA;
          }
        }
      });
  }, [videos, activeCategory, sortBy, search]);

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>

        {showCount && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {filteredVideos.length} videos
          </span>
        )}
      </div>

      {showSearch && (
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar videos, lugares o creadores..."
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-slate-400"
        />
      )}

      {showFilters && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {VIDEO_CATEGORIES.map(category => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
                activeCategory === category
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-slate-400" />

        {SORT_OPTIONS.map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSortBy(option.id)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
              sortBy === option.id
                ? 'border-[#E05A47] bg-[#E05A47]/10 text-[#C94B39]'
                : 'border-slate-200 text-slate-500'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filteredVideos.length > 0 ? (
        <div className={
          compact
            ? 'grid grid-cols-2 gap-2'
            : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
        }>
          {filteredVideos.map(video => (
            <div key={video.id} className="min-w-0 space-y-2">
              <TikTokVideoCard
                videoUrl={video.videoUrl}
                title={video.title}
                creator={video.creator}
                placeName={video.placeName}
                thumbnailUrl={video.thumbnailUrl}
                category={video.category}
                platform={video.platform}
              />

              {/* Métricas: separación estricta de métricas externas (TikTok) y métricas de plataforma */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-600">
                  {typeof video.externalViews === 'number' && video.externalViews > 0 ? (
                    <span className="flex items-center gap-1 font-semibold text-slate-800" title="Vistas en TikTok">
                      <Eye className="h-3 w-3 text-[#E85B49]" />
                      {video.externalViews.toLocaleString('es-PE')}
                    </span>
                  ) : null}

                  {typeof video.externalLikes === 'number' && video.externalLikes > 0 ? (
                    <span className="flex items-center gap-1 font-semibold text-slate-800" title="Likes en TikTok">
                      <Heart className="h-3 w-3 text-rose-500 fill-rose-500/20" />
                      {video.externalLikes.toLocaleString('es-PE')}
                    </span>
                  ) : null}

                  {video.externalViews == null && video.externalLikes == null && (
                    <span className="text-[10px] text-slate-400 italic">
                      Métricas sociales en verificación
                    </span>
                  )}
                </div>

                {/* Métricas internas en la app */}
                {((video.internalViews ?? 0) > 0 || (video.internalSaves ?? 0) > 0) && (
                  <div className="flex flex-wrap items-center gap-x-2 text-[9px] text-slate-400">
                    {(video.internalViews ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5" title="Reproducciones en LibertadGO">
                        <Play className="h-2.5 w-2.5 text-slate-400" />
                        {video.internalViews?.toLocaleString('es-PE')} en app
                      </span>
                    )}
                    {(video.internalSaves ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5" title="Guardado en favoritos">
                        <Bookmark className="h-2.5 w-2.5 text-amber-500" />
                        {video.internalSaves} guardados
                      </span>
                    )}
                  </div>
                )}
              </div>

              <p className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock className="h-3 w-3" />
                {video.updatedAt}
              </p>

              {video.demo && (
                <span className="inline-block rounded bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-700">
                  Demostración
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center bg-white">
          <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            No encontramos publicaciones con estos filtros
          </p>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Prueba seleccionando otra categoría o limpiando los términos de búsqueda.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('Todos');
              setSearch('');
              setSortBy('popular');
              if (onClearFilters) onClearFilters();
            }}
            className="mt-3 inline-flex items-center justify-center rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </section>
  );
}
