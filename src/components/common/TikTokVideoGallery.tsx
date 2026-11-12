import React, { useMemo, useState } from 'react';
import { TikTokVideoCard } from './TikTokVideoCard.tsx';
import { Eye, Heart, Clock, TrendingUp, Bookmark, Play, Users } from 'lucide-react';
import { FILTER_CATEGORIES } from '../../utils/filterUtils.ts';

export interface TikTokVideo {
  id: string;
  videoUrl: string;
  title: string;
  creator: string;
  creatorAvatarUrl?: string;
  creatorHandle?: string;
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
  tiktokFollowers?: number | null;
  instagramFollowers?: number | null;
  youtubeSubscribers?: number | null;
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

export const SORT_OPTIONS = [
  { id: 'popular', label: 'Más vistos en TikTok' },
  { id: 'likes', label: 'Más likes' },
  { id: 'app_views', label: 'Más vistos en app' },
  { id: 'recent', label: 'Más recientes' },
  { id: 'tiktok_followers', label: 'Más seguidores en TikTok' },
  { id: 'instagram_followers', label: 'Más seguidores en Instagram' },
  { id: 'youtube_subscribers', label: 'Más suscriptores en YouTube' },
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
          case 'tiktok_followers': {
            const fA = a.tiktokFollowers;
            const fB = b.tiktokFollowers;
            if (fA == null && fB == null) return 0;
            if (fA == null) return 1; // nulls last
            if (fB == null) return -1;
            if (fB !== fA) return fB - fA;
            const timeB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
            const timeA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
            return timeB - timeA;
          }
          case 'instagram_followers': {
            const fA = a.instagramFollowers;
            const fB = b.instagramFollowers;
            if (fA == null && fB == null) return 0;
            if (fA == null) return 1; // nulls last
            if (fB == null) return -1;
            if (fB !== fA) return fB - fA;
            const timeB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
            const timeA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
            return timeB - timeA;
          }
          case 'youtube_subscribers': {
            const fA = a.youtubeSubscribers;
            const fB = b.youtubeSubscribers;
            if (fA == null && fB == null) return 0;
            if (fA == null) return 1; // nulls last
            if (fB == null) return -1;
            if (fB !== fA) return fB - fA;
            const timeB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
            const timeA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
            return timeB - timeA;
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

      {/* Filtros de ordenación compactos */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-slate-400 mr-1" />

        {SORT_OPTIONS.map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSortBy(option.id)}
            className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              sortBy === option.id
                ? 'border-[#E85B49] bg-[#E85B49] text-white'
                : 'border-[#E9E7E1] text-[#64748B] hover:text-[#263B35] bg-white hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filteredVideos.length > 0 ? (
        <div className={
          compact
            ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'
        }>
          {filteredVideos.map(video => (
            <div key={video.id} className="min-w-0">
              <TikTokVideoCard
                videoUrl={video.videoUrl}
                title={video.title}
                creator={video.creator}
                creatorHandle={video.creatorHandle}
                creatorAvatarUrl={video.creatorAvatarUrl}
                placeName={video.placeName}
                thumbnailUrl={video.thumbnailUrl}
                category={video.category}
                platform={video.platform}
                publishedDate={video.updatedAt}
                isApproved={true}
              />
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
