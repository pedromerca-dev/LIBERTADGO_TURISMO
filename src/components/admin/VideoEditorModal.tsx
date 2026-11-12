import React, { useState, useEffect } from 'react';
import {
  X,
  Video,
  Check,
  AlertCircle,
  ExternalLink,
  MapPin,
  Star,
  Search,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { VideoSubmission, CreatorProfile, VideoContentType, ModerationStatus } from '../../types/creators.ts';
import { Place } from '../../types/catalog.ts';
import { INITIAL_PLACES } from '../../data/initialPlaces.ts';
import { LA_LIBERTAD_LOCALITIES } from '../../types/geo.ts';
import { parseAndValidateVideoUrl } from '../../utils/videoUrlParser.ts';

interface VideoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoSaved: () => void;
  initialVideo?: (VideoSubmission & { places?: Place[] }) | null;
  creators: CreatorProfile[];
}

const CATEGORIES = [
  { id: 'restaurantes', name: 'Restaurantes y Gastronomía' },
  { id: 'arqueologia', name: 'Sitios Arqueológicos' },
  { id: 'playas', name: 'Playas y Surf' },
  { id: 'hoteles', name: 'Hospedaje y Hoteles' },
  { id: 'cafeterias', name: 'Cafeterías y Bares' },
  { id: 'cultura', name: 'Museos y Cultura' },
  { id: 'naturaleza', name: 'Naturaleza y Paisajes' },
  { id: 'artesania', name: 'Artesanías y Tradición' },
  { id: 'aventura', name: 'Aventura y Deportes' },
];

export const VideoEditorModal: React.FC<VideoEditorModalProps> = ({
  isOpen,
  onClose,
  onVideoSaved,
  initialVideo,
  creators,
}) => {
  const { token } = useAuth();
  const isEditing = Boolean(initialVideo);

  const [videoUrl, setVideoUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<VideoContentType>('PLACE');
  const [category, setCategory] = useState('restaurantes');
  const [localityId, setLocalityId] = useState('trujillo');
  const [creatorProfileId, setCreatorProfileId] = useState<string>('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  const [primaryPlaceId, setPrimaryPlaceId] = useState<string>('');
  const [status, setStatus] = useState<ModerationStatus>('APPROVED');
  const [placeSearch, setPlaceSearch] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live URL validation state
  const [urlValidation, setUrlValidation] = useState<{
    isValid: boolean;
    platform?: string;
    error?: string;
  }>({ isValid: false });

  useEffect(() => {
    if (initialVideo) {
      setVideoUrl(initialVideo.videoUrl);
      setTitle(initialVideo.title);
      setDescription(initialVideo.description || '');
      setContentType(initialVideo.contentType);
      setCategory(initialVideo.category);
      setLocalityId(initialVideo.localityId || 'trujillo');
      setCreatorProfileId(initialVideo.creatorProfileId || '');
      setThumbnailUrl(initialVideo.thumbnailUrl || '');
      setStatus(initialVideo.status);

      const pIds = initialVideo.places?.map((p) => p.id) || [];
      setSelectedPlaceIds(pIds);
      setPrimaryPlaceId(pIds[0] || '');
      setUrlValidation({ isValid: true, platform: initialVideo.platform });
    } else {
      setVideoUrl('');
      setTitle('');
      setDescription('');
      setContentType('PLACE');
      setCategory('restaurantes');
      setLocalityId('trujillo');
      setCreatorProfileId('');
      setThumbnailUrl('');
      setSelectedPlaceIds([]);
      setPrimaryPlaceId('');
      setStatus('APPROVED');
      setUrlValidation({ isValid: false });
    }
    setErrorMessage(null);
    setPlaceSearch('');
  }, [initialVideo, isOpen]);

  // Handle URL change with live validation
  const handleUrlChange = (url: string) => {
    setVideoUrl(url);
    if (!url.trim()) {
      setUrlValidation({ isValid: false });
      return;
    }

    const parsed = parseAndValidateVideoUrl(url);
    if (parsed.isValid && parsed.data) {
      setUrlValidation({
        isValid: true,
        platform: parsed.data.platform,
      });
      // Auto-fill title if empty
      if (!title && parsed.data.platform === 'tiktok') {
        setTitle(`Experiencia turística TikTok en La Libertad`);
      }
    } else {
      setUrlValidation({
        isValid: false,
        error: parsed.error || 'URL no soportada',
      });
    }
  };

  const handleTogglePlace = (placeId: string) => {
    setSelectedPlaceIds((prev) => {
      if (prev.includes(placeId)) {
        const next = prev.filter((id) => id !== placeId);
        if (primaryPlaceId === placeId) {
          setPrimaryPlaceId(next[0] || '');
        }
        return next;
      } else {
        if (prev.length >= 10) return prev;
        const next = [...prev, placeId];
        if (!primaryPlaceId) {
          setPrimaryPlaceId(placeId);
        }
        return next;
      }
    });
  };

  const filteredPlaces = INITIAL_PLACES.filter((p) => {
    const q = placeSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.localityName.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }).slice(0, 30); // show top 30 matching

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!urlValidation.isValid) {
      setErrorMessage('Por favor ingresa un enlace válido de TikTok, Instagram Reels o YouTube');
      return;
    }

    if (title.trim().length < 5) {
      setErrorMessage('El título debe contener al menos 5 caracteres');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        videoUrl: videoUrl.trim(),
        title: title.trim(),
        description: description.trim() || null,
        contentType,
        category,
        localityId: localityId || null,
        thumbnailUrl: thumbnailUrl.trim() || null,
        creatorProfileId: creatorProfileId || null,
        placeIds: selectedPlaceIds,
        primaryPlaceId: primaryPlaceId || selectedPlaceIds[0] || null,
        status,
      };

      const endpoint = isEditing ? `/api/admin/videos/${initialVideo!.id}` : '/api/admin/videos';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al procesar la publicación');
      }

      onVideoSaved();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E85B49] flex items-center justify-center text-white">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">
                {isEditing ? 'Editar Publicación de Video' : 'Registrar Nuevo Video Turístico'}
              </h3>
              <p className="text-[11px] text-slate-400">
                TikTok, Instagram Reels y YouTube Shorts vinculados al catálogo de La Libertad
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Video URL Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">
              Enlace del Video (TikTok, Instagram, YouTube) *
            </label>
            <div className="relative">
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://www.tiktok.com/@usuario/video/1234567890..."
                disabled={isEditing}
                className="w-full text-xs p-2.5 pr-24 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] focus:ring-1 focus:ring-[#E85B49] disabled:bg-slate-100 disabled:text-slate-500"
                required
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {urlValidation.isValid ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {urlValidation.platform}
                  </span>
                ) : videoUrl.trim() ? (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium">
                    No válido
                  </span>
                ) : null}
              </div>
            </div>
            {urlValidation.error && (
              <p className="text-[11px] text-red-500">{urlValidation.error}</p>
            )}
            <p className="text-[11px] text-slate-500">
              Pega el enlace original. No se descargarán ni alojarán archivos multimedia de terceros; se utiliza embebido oficial seguro.
            </p>
          </div>

          {/* Title & Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-semibold text-slate-800">
                Título de la Publicación *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Los mejores ceviches de Huanchaco frente al mar"
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                required
                minLength={5}
                maxLength={140}
              />
              <span className="text-[10px] text-slate-400 float-right">{title.length}/140</span>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-semibold text-slate-800">
                Descripción / Resumen
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle o recomendación turística descrita en el video..."
                rows={2}
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                maxLength={1000}
              />
            </div>
          </div>

          {/* Category, Locality & Content Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">Categoría *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">Localidad *</label>
              <select
                value={localityId}
                onChange={(e) => setLocalityId(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
              >
                {LA_LIBERTAD_LOCALITIES.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">Tipo de Contenido</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as VideoContentType)}
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
              >
                <option value="PLACE">Lugar Turístico Específico</option>
                <option value="ROUTE">Ruta o Circuito Diario</option>
                <option value="GENERAL">Recomendación General / Tips</option>
              </select>
            </div>
          </div>

          {/* Creator Attribution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Creador Asignado
              </label>
              <select
                value={creatorProfileId}
                onChange={(e) => setCreatorProfileId(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
              >
                <option value="">— Sin creador asignado (Oficial / General) —</option>
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>
                    @{c.handle} ({c.displayName}) - {c.primaryPlatform}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Estado de la Publicación
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ModerationStatus)}
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] font-medium"
              >
                <option value="APPROVED">Aprobado (Visible en el ranking público)</option>
                <option value="PENDING">Pendiente de Revisión</option>
                <option value="OBSERVED">Observado</option>
                <option value="HIDDEN">Oculto</option>
                <option value="REJECTED">Rechazado</option>
              </select>
            </div>
          </div>

          {/* Place Association: Search & Multi-select */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                Lugares Turísticos Asociados ({selectedPlaceIds.length}/10)
              </label>
              <span className="text-[11px] text-slate-500">
                Busca entre los 297 lugares del catálogo oficial
              </span>
            </div>

            {/* Selected places chips */}
            {selectedPlaceIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                {selectedPlaceIds.map((pId) => {
                  const place = INITIAL_PLACES.find((p) => p.id === pId);
                  const isPrimary = primaryPlaceId === pId;
                  return (
                    <span
                      key={pId}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                        isPrimary
                          ? 'bg-[#E85B49]/10 text-[#E85B49] border-[#E85B49]/30'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setPrimaryPlaceId(pId)}
                        title={isPrimary ? 'Lugar principal' : 'Establecer como principal'}
                        className="cursor-pointer"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            isPrimary ? 'fill-[#E85B49] text-[#E85B49]' : 'text-slate-400 hover:text-amber-500'
                          }`}
                        />
                      </button>
                      <span className="truncate max-w-[180px]">{place?.name || pId}</span>
                      <button
                        type="button"
                        onClick={() => handleTogglePlace(pId)}
                        className="text-slate-400 hover:text-red-500 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={placeSearch}
                onChange={(e) => setPlaceSearch(e.target.value)}
                placeholder="Buscar lugar por nombre o localidad (ej. Chan Chan, Huanchaco, El Rincón)..."
                className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
              />
            </div>

            {/* Available Places List */}
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
              {filteredPlaces.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No se encontraron lugares que coincidan con la búsqueda.
                </div>
              ) : (
                filteredPlaces.map((p) => {
                  const isSelected = selectedPlaceIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleTogglePlace(p.id)}
                      className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-amber-50/60 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by row click
                          className="rounded text-[#E85B49] focus:ring-[#E85B49]"
                        />
                        <div className="min-w-0">
                          <span className="text-slate-900 truncate block">{p.name}</span>
                          <span className="text-[10px] text-slate-400 capitalize block">
                            {p.localityName} • {p.category}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        {p.rating ? `★ ${p.rating}` : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !urlValidation.isValid}
              className="px-5 py-2 text-xs font-bold text-white bg-[#E85B49] hover:bg-[#d64f3e] disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Guardar Cambios' : 'Registrar Publicación'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
