
import React, { useMemo, useState } from 'react';
import { TikTokVideoCard } from './TikTokVideoCard';
import { Eye, Heart, Star, Clock, TrendingUp } from 'lucide-react';
import { FILTER_CATEGORIES } from '../../utils/filterUtils';

export interface TikTokVideo {
  id: string;
  videoUrl: string;
  title: string;
  creator: string;
  placeName: string;
  category: string;
  thumbnailUrl?: string;
  views: number;
  likes: number;
  rating: number;
  updatedAt: string;
  demo?: boolean;
  locality?: string;
  department?: string;
}

interface TikTokVideoGalleryProps {
  videos: TikTokVideo[];
  title?: string;
  description?: string;
  showFilters?: boolean;
  showSearch?: boolean;
  compact?: boolean;
  showCount?: boolean;
}

const VIDEO_CATEGORIES = FILTER_CATEGORIES.map(category => category.label);

const SORT_OPTIONS = [
  { id: 'popular', label: 'Más vistos' },
  { id: 'likes', label: 'Más likes' },
  { id: 'rating', label: 'Mejor valorados' },
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
          video.category === activeCategory;

        const matchesSearch =
          !normalizedSearch ||
          video.title.toLowerCase().includes(normalizedSearch) ||
          video.creator.toLowerCase().includes(normalizedSearch) ||
          video.placeName.toLowerCase().includes(normalizedSearch);

        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'likes':
            return b.likes - a.likes;
          case 'rating':
            return b.rating - a.rating;
          case 'recent':
            return new Date(b.updatedAt).getTime() -
              new Date(a.updatedAt).getTime();
          default:
            return b.views - a.views;
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
              />

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {(video.views ?? 0).toLocaleString('es-PE')}
                </span>

                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {(video.likes ?? 0).toLocaleString('es-PE')}
                </span>

                <span className="flex items-center gap-1 text-amber-600">
                  <Star className="h-3 w-3 fill-amber-500" />
                  {(video.rating ?? 0).toFixed(1)}
                </span>
              </div>

              <p className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock className="h-3 w-3" />
                Actualizado: {video.updatedAt}
              </p>

              {video.demo && (
                <span className="inline-block rounded bg-amber-50 px-2 py-1 text-[9px] text-amber-700">
                  Datos de demostración
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No encontramos videos en esta categoría
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Prueba otra categoría o modifica tu búsqueda.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('Todos');
              setSearch('');
              setSortBy('popular');
            }}
            className="mt-2 text-xs font-semibold text-[#E05A47] underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </section>
  );
}
