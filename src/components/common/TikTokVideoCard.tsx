
import React from 'react';

interface TikTokVideoCardProps {
  videoUrl: string;
  title: string;
  creator: string;
  placeName?: string;
  thumbnailUrl?: string;
  category?: string;
  platform?: string;
}

export function TikTokVideoCard({
  videoUrl,
  title,
  creator,
  placeName,
  thumbnailUrl,
  category = 'Video turístico',
  platform = 'tiktok',
}: TikTokVideoCardProps) {
  const platformLabel =
    platform === 'youtube' ? 'YouTube' : platform === 'instagram' ? 'Instagram' : 'TikTok';

  return (
    <article className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/10">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.4v13.67a2.9 2.9 0 0 1-2.9 2.9 2.9 2.9 0 1 1 2.9-2.9V12.2a6.3 6.3 0 1 0 3.4 5.6V10.8a8.2 8.2 0 0 0 4.8 1.55V8.96a4.85 4.85 0 0 1-1.03-.27Z" />
              </svg>
            </div>
            <span className="text-xs text-white/70">Video disponible en {platformLabel}</span>
          </div>
        )}

        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
          {category}
        </span>

        <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
          {platformLabel}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
            {title}
          </h3>
          <p className="mt-1 text-xs text-gray-500">{creator}</p>
        </div>

        {placeName && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <span aria-hidden="true">📍</span>
            {placeName}
          </p>
        )}

        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
        >
          Ver en {platformLabel}
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}
