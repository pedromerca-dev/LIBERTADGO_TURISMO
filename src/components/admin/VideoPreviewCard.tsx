import React, { useState } from 'react';
import {
  Video,
  Play,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Eye,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { VideoPreviewData, PreviewState } from '../../server/oembedService.ts';

interface VideoPreviewCardProps {
  state: PreviewState;
  data?: VideoPreviewData | null;
  rawUrl: string;
  errorMessage?: string;
  onRetry?: () => void;
}

export const VideoPreviewCard: React.FC<VideoPreviewCardProps> = ({
  state,
  data,
  rawUrl,
  errorMessage,
  onRetry,
}) => {
  const [viewMode, setViewMode] = useState<'player' | 'thumbnail'>('player');

  // 1. Estado: Sin enlace
  if (state === 'idle' || !rawUrl.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center">
        <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <Video className="w-4 h-4" />
          </div>
          <p className="text-xs font-medium text-slate-600">
            Vista previa no inicializada
          </p>
          <p className="text-[11px] text-slate-400 max-w-sm">
            Pega un enlace válido de TikTok, YouTube o Instagram para previsualizar el contenido oficial antes de registrar.
          </p>
        </div>
      </div>
    );
  }

  // 2. Estado: Cargando previsualización
  if (state === 'loading') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-center gap-3 text-slate-600">
          <RefreshCw className="w-4 h-4 animate-spin text-[#E85B49]" />
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-800">
              Cargando previsualización oficial...
            </p>
            <p className="text-[11px] text-slate-500">
              Identificando plataforma y validando embed oficial seguro
            </p>
          </div>
        </div>
        <div className="mt-3 h-24 bg-slate-200/60 rounded-lg animate-pulse" />
      </div>
    );
  }

  // 3. Estado: Enlace inválido
  if (state === 'invalid_format') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 flex items-start gap-2.5 text-amber-900">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-amber-800">Enlace no reconocido</p>
          <p className="text-[11px] text-amber-700">
            {errorMessage ||
              'Asegúrate de pegar un enlace directo a un video de TikTok (@usuario/video/...), YouTube (watch, youtu.be, shorts) o Instagram (/reel/, /p/).'}
          </p>
        </div>
      </div>
    );
  }

  // 4. Estado: Error temporal del proveedor
  if (state === 'provider_error') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2.5">
        <div className="flex items-start gap-2 text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs flex-1">
            <p className="font-semibold">Error temporal del proveedor</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              {errorMessage ||
                'No se pudo conectar temporalmente con el servicio de oEmbed. Puedes continuar y registrar el video; su enlace original se conservará intacto.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-amber-200/60">
          <a
            href={rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-amber-800 hover:text-amber-900 font-medium inline-flex items-center gap-1"
          >
            Ver enlace original
            <ExternalLink className="w-3 h-3" />
          </a>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-[11px] font-semibold text-amber-800 hover:text-amber-900 bg-white border border-amber-300 rounded px-2.5 py-1 inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  // 5. Estado: Previsualización no disponible
  if (state === 'unavailable' || !data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-2 text-slate-700">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-slate-800">
              No se pudo generar la vista previa.
            </p>
            <p className="text-[11px] text-slate-600">
              El video puede ser privado, haber sido eliminado o tener restricciones de incrustación por parte del autor.
            </p>
            <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              El enlace original puede registrarse igualmente.
            </p>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between">
          <a
            href={rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#E85B49] hover:underline font-semibold inline-flex items-center gap-1"
          >
            Comprobar enlace original
            <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-[10px] text-slate-400 font-mono truncate max-w-xs">
            {rawUrl}
          </span>
        </div>
      </div>
    );
  }

  // 6. Estado: Previsualización disponible (ready)
  const isYouTube = data.platform === 'youtube';
  const isTikTok = data.platform === 'tiktok';
  const isInstagram = data.platform === 'instagram';

  const platformBadgeStyle = isYouTube
    ? 'bg-red-100 text-red-800 border-red-200'
    : isTikTok
    ? 'bg-slate-900 text-cyan-300 border-slate-800'
    : 'bg-gradient-to-r from-pink-500 to-amber-500 text-white border-transparent';

  const platformName = isYouTube ? 'YouTube' : isTikTok ? 'TikTok' : 'Instagram';

  // Strict domain validation before rendering iframe
  const isEmbedSafe = (() => {
    try {
      const u = new URL(data.embedUrl);
      if (u.protocol !== 'https:') return false;
      const host = u.hostname.toLowerCase();
      if (isYouTube) {
        return host === 'youtube-nocookie.com' || host === 'www.youtube-nocookie.com' || host === 'youtube.com' || host === 'www.youtube.com';
      }
      if (isTikTok) {
        return host === 'tiktok.com' || host === 'www.tiktok.com';
      }
      if (isInstagram) {
        return host === 'instagram.com' || host === 'www.instagram.com';
      }
      return false;
    } catch {
      return false;
    }
  })();

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs transition-all">
      {/* Header bar */}
      <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border flex items-center gap-1 shrink-0 ${platformBadgeStyle}`}
          >
            {platformName}
          </span>
          <span className="text-xs font-semibold text-slate-800 truncate">
            {data.title || `${platformName} Video`}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {data.thumbnailUrl && isEmbedSafe && (
            <div className="flex items-center rounded-lg bg-slate-200/80 p-0.5 text-[10px] font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setViewMode('player')}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  viewMode === 'player'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Reproductor
              </button>
              <button
                type="button"
                onClick={() => setViewMode('thumbnail')}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  viewMode === 'thumbnail'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Miniatura
              </button>
            </div>
          )}

          <a
            href={data.canonicalUrl || rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir video en nueva pestaña"
            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200/60 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="p-3 bg-slate-950 flex flex-col items-center justify-center">
        {viewMode === 'player' && isEmbedSafe ? (
          <div
            className={`w-full flex items-center justify-center ${
              isYouTube
                ? 'max-w-md aspect-video'
                : isTikTok
                ? 'max-w-[280px] h-[340px]'
                : 'max-w-[320px] h-[360px]'
            }`}
          >
            <iframe
              src={data.embedUrl}
              title={`Previsualización oficial ${platformName}`}
              className="w-full h-full rounded-lg border-0 bg-black"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox={
                isYouTube
                  ? 'allow-scripts allow-same-origin allow-presentation'
                  : 'allow-scripts allow-same-origin allow-popups'
              }
            />
          </div>
        ) : data.thumbnailUrl ? (
          <div className="relative w-full max-w-md aspect-video rounded-lg overflow-hidden bg-slate-900 group">
            <img
              src={data.thumbnailUrl}
              alt={data.title || 'Miniatura oficial del video'}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setViewMode('player')}
                className="w-12 h-12 rounded-full bg-[#E85B49] hover:bg-[#d64f3e] text-white flex items-center justify-center shadow-lg transform transition group-hover:scale-110 cursor-pointer"
                title="Reproducir video"
              >
                <Play className="w-5 h-5 ml-0.5 fill-current" />
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Eye className="w-6 h-6 mx-auto mb-1 text-slate-500" />
            <p>Reproductor oficial disponible en ventana externa</p>
          </div>
        )}
      </div>

      {/* Footer Details */}
      <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-semibold text-slate-700">Autor:</span>
          {data.authorUrl ? (
            <a
              href={data.authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E85B49] hover:underline font-medium truncate"
            >
              {data.authorName || 'Ver perfil'}
            </a>
          ) : (
            <span className="text-slate-800 font-medium truncate">
              {data.authorName || 'No especificado'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 text-[10px] text-emerald-700 font-medium">
          <CheckCircle2 className="w-3 h-3" />
          <span>Previsualización oficial lista</span>
        </div>
      </div>
    </div>
  );
};
