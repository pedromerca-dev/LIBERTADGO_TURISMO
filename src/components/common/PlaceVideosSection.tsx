import React, { useState, useEffect, useCallback } from 'react';
import { Video, Sparkles, AlertCircle, RefreshCw, PlusCircle } from 'lucide-react';
import { TikTokVideoGallery, TikTokVideo } from './TikTokVideoGallery.tsx';
import { adaptVideoSubmissionToTikTokVideo, VideoSubmissionWithPlaces } from '../../utils/videoAdapter.ts';

interface PlaceVideosSectionProps {
  placeId: string;
  placeName: string;
  compact?: boolean;
  onShareVideo?: () => void;
}

export const PlaceVideosSection: React.FC<PlaceVideosSectionProps> = ({
  placeId,
  placeName,
  compact = true,
  onShareVideo,
}) => {
  const [videos, setVideos] = useState<TikTokVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaceVideos = useCallback(async () => {
    if (!placeId) {
      setVideos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/places/${encodeURIComponent(placeId)}/videos`);
      if (!res.ok) {
        if (res.status === 404) {
          setVideos([]);
          return;
        }
        throw new Error(`Error ${res.status}: no se pudieron cargar los videos`);
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Error al obtener videos asociados');
      }

      const rawVideos: VideoSubmissionWithPlaces[] = json.data || [];
      const adapted = rawVideos.map(adaptVideoSubmissionToTikTokVideo);
      setVideos(adapted);
    } catch (err: unknown) {
      console.error(`[PlaceVideosSection] Error fetching videos for ${placeId}:`, err);
      setError(err instanceof Error ? err.message : 'Error al consultar videos');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    fetchPlaceVideos();
  }, [fetchPlaceVideos]);

  if (loading) {
    return (
      <div className="py-4 px-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E85B49]" />
        <span>Consultando videos de este lugar...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-3 px-3 rounded-xl bg-rose-50/70 border border-rose-100 flex items-center justify-between text-xs text-rose-700">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={fetchPlaceVideos}
          className="text-[11px] font-semibold text-rose-800 underline hover:no-underline ml-2 cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50/60 to-white p-4 text-center">
        <div className="w-9 h-9 mx-auto rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-2.5">
          <Video className="w-4 h-4 text-slate-400" />
        </div>
        <h4 className="text-xs font-bold text-slate-800">
          Próximamente descubrirás videos de este lugar
        </h4>
        <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
          Aún no se han publicado videos de este destino en Wayra.
        </p>

        {onShareVideo ? (
          <button
            type="button"
            onClick={onShareVideo}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#E85B49] bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>¿Conoces este lugar? Comparte un video</span>
          </button>
        ) : (
          <div className="mt-2.5 text-[11px] font-medium text-slate-400 inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>¿Conoces este lugar? Sé el primero en compartir un video</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <TikTokVideoGallery
        title="Videos de este lugar"
        description={`Experiencias reales compartidas en ${placeName}`}
        videos={videos}
        showFilters={videos.length > 3}
        showSearch={false}
        compact={compact}
        showCount={true}
      />
    </div>
  );
};
