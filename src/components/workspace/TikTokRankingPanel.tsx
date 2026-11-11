
import React, { useMemo, useState } from 'react';
import { MapPin, Trophy } from 'lucide-react';
import { TikTokVideoGallery } from '../common/TikTokVideoGallery';
import { demoTikTokVideos } from '../../data/demoTikTokVideos';
import {
  LOCALITY_FILTER_OPTIONS,
  normalizeText,
} from '../../utils/filterUtils';

export const TikTokRankingPanel: React.FC = () => {
  const [locality, setLocality] = useState('todas');


  const filteredVideos = useMemo(() => {
    return demoTikTokVideos.filter(video => {
      const selectedLocality = LOCALITY_FILTER_OPTIONS.find(
        option => option.id === locality
      );
  
      const matchesLocality =
        locality === 'todas' ||
        normalizeText(video.locality ?? '') ===
          normalizeText(selectedLocality?.name ?? '');
  
      return matchesLocality;
    });
  }, [locality]);

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto bg-[#F8FAFC]">
      <div className="p-4 sm:p-5 space-y-4">

        {/* Encabezado */}
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#E85B49]" />
            <h2 className="text-lg font-bold text-[#17243A]">
              Ranking de videos
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Descubre las experiencias turísticas más populares.
          </p>
        </div>

      {/* Filtros compactos */}
<div className="flex flex-wrap items-center gap-2">
  <div className="relative flex-1 min-w-[160px]">
    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

    <select
      value={locality}
      onChange={event => setLocality(event.target.value)}
      className="w-full appearance-none rounded-full border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-medium text-slate-700 outline-none focus:border-[#E85B49]"
    >
      <option value="todas">Toda La Libertad</option>

      {LOCALITY_FILTER_OPTIONS
        .filter(option => option.id !== 'todas')
        .map(option => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
    </select>
  </div>
</div>

        {/* Galería */}
        <div className="border-t border-slate-200 pt-4">
          <TikTokVideoGallery
            videos={filteredVideos}
            title="Videos destacados"
            description="Explora las experiencias compartidas por viajeros."
            showFilters={true}
            showSearch={true}
            showCount={false}
            compact={false}
          />
        </div>

      </div>
    </div>
  );
};
