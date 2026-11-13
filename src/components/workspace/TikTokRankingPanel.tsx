import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Trophy, RefreshCw, AlertCircle, Video, Sparkles } from 'lucide-react';
import { TikTokVideoGallery, TikTokVideo } from '../common/TikTokVideoGallery';
import { LOCALITY_FILTER_OPTIONS } from '../../utils/filterUtils';
import { adaptVideoSubmissionToTikTokVideo, VideoSubmissionWithPlaces } from '../../utils/videoAdapter';

export const TikTokRankingPanel: React.FC = () => {
  const [locality, setLocality] = useState('todas');
  const [videos, setVideos] = useState<TikTokVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApprovedVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (locality && locality !== 'todas') {
        params.set('localityId', locality);
      }

      const res = await fetch(`/api/creators/videos?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Error del servidor (${res.status})`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'No fue posible cargar los videos');
      }

      const rawSubmissions: VideoSubmissionWithPlaces[] = data.data || [];
      const adapted = rawSubmissions.map(adaptVideoSubmissionToTikTokVideo);
      setVideos(adapted);
    } catch (err: unknown) {
      console.error('[Ranking] Error fetching approved videos from Neon:', err);
      const msg = err instanceof Error ? err.message : 'Error al conectar con la base de datos de videos';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [locality]);

  useEffect(() => {
    fetchApprovedVideos();
  }, [fetchApprovedVideos]);

  const selectedLocalityOption = LOCALITY_FILTER_OPTIONS.find(
    (option) => option.id === locality
  );
  const localityDisplayName = selectedLocalityOption?.name || 'La Libertad';

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto bg-[#F8FAFC]">
      <div className="p-4 sm:p-5 space-y-4">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#E85B49]" />
              <h2 className="text-lg font-bold text-[#17243A]">
                Ranking de videos
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Publicaciones reales y verificadas de creadores y viajeros en La Libertad.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchApprovedVideos}
            disabled={loading}
            title="Actualizar ranking"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#E85B49]' : ''}`} />
          </button>
        </div>

        {/* Filtros compactos */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

            <select
              value={locality}
              onChange={(event) => setLocality(event.target.value)}
              disabled={loading}
              className="w-full appearance-none rounded-full border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-medium text-slate-700 outline-none focus:border-[#E85B49] disabled:bg-slate-50"
            >
              <option value="todas">Toda La Libertad</option>

              {LOCALITY_FILTER_OPTIONS.filter((option) => option.id !== 'todas').map(
                (option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {/* Contenido principal según estado de la API */}
        <div className="border-t border-slate-200 pt-4">
          {/* 1. Estado de carga (Skeleton) */}
          {loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-16 bg-slate-200 rounded-full animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 space-y-2 animate-pulse"
                  >
                    <div className="aspect-[16/9] w-full rounded-xl bg-slate-200" />
                    <div className="h-3 w-3/4 bg-slate-200 rounded" />
                    <div className="h-2.5 w-1/2 bg-slate-200 rounded" />
                    <div className="h-2 w-1/3 bg-slate-200 rounded mt-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Estado de error con reintento */}
          {!loading && error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  No se pudo cargar el ranking
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {error}
                </p>
              </div>
              <button
                type="button"
                onClick={fetchApprovedVideos}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E85B49] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#d64a39] transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reintentar
              </button>
            </div>
          )}

          {/* 3. Estado vacío elegante */}
          {!loading && !error && videos.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center shadow-sm">
                <Video className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">
                  {locality !== 'todas'
                    ? `Aún no hay videos aprobados en ${localityDisplayName}`
                    : 'Aún no hay publicaciones aprobadas en el ranking'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {locality !== 'todas'
                    ? 'Prueba explorando toda la región de La Libertad o sé el primero en recomendar este destino.'
                    : 'Las experiencias compartidas por creadores pasan por moderación técnica antes de publicarse.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {locality !== 'todas' && (
                  <button
                    type="button"
                    onClick={() => setLocality('todas')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#E85B49]" />
                    Ver toda La Libertad
                  </button>
                )}

                <div className="w-full mt-2 rounded-xl bg-slate-50 p-3 border border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-600">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    ¿Eres creador o viajero? Publica tus reels o videos de TikTok desde tu perfil.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4. Galería con videos de la base de datos */}
          {!loading && !error && videos.length > 0 && (
            <TikTokVideoGallery
              videos={videos}
              title={`Videos destacados en ${localityDisplayName}`}
              description="Contenido verificado con métricas reales y enlaces a creadores."
              showFilters={true}
              showSearch={true}
              showCount={true}
              compact={false}
              onClearFilters={() => setLocality('todas')}
            />
          )}
        </div>
      </div>
    </div>
  );
};
