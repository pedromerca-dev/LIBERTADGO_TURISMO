import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Video,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  Shield,
  Plus,
  Search,
  Edit2,
  History,
  User,
  CheckCircle2,
  MapPin,
  Users,
  EyeOff,
  AlertTriangle,
  PlaySquare,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { VideoSubmission, ModerationStatus, CreatorProfile, VideoPlace } from '../../types/creators.ts';
import { INITIAL_PLACES } from '../../data/initialPlaces.ts';
import { VideoEditorModal } from './VideoEditorModal.tsx';
import { CreatorEditorModal } from './CreatorEditorModal.tsx';
import { VideoHistoryModal } from './VideoHistoryModal.tsx';
import { resolveCreatorLabel } from '../../utils/videoAdapter.ts';

interface EnrichedVideoSubmission extends VideoSubmission {
  places?: VideoPlace[];
}

export const AdminCreatorModerationView: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'videos' | 'creators'>('videos');

  // Video Tab State
  const [videos, setVideos] = useState<EnrichedVideoSubmission[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [videoSearchQuery, setVideoSearchQuery] = useState('');
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Creators Tab State
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [creatorSearchQuery, setCreatorSearchQuery] = useState('');
  const [isLoadingCreators, setIsLoadingCreators] = useState(true);

  // Modals state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoSubmission | undefined>(undefined);

  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);
  const [editingCreator, setEditingCreator] = useState<CreatorProfile | undefined>(undefined);

  const [historyVideo, setHistoryVideo] = useState<{ id: string; title: string } | null>(null);

  // Reason Modal for OBSERVE / REJECT
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    videoId: string;
    action: 'OBSERVE' | 'REJECT' | 'HIDE';
    title: string;
    reason: string;
    internalNotes: string;
  }>({
    isOpen: false,
    videoId: '',
    action: 'OBSERVE',
    title: '',
    reason: '',
    internalNotes: '',
  });

  const placesMap = useMemo(() => {
    return new Map(INITIAL_PLACES.map((p) => [p.id, p]));
  }, []);

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    setIsLoadingVideos(true);
    try {
      const url =
        statusFilter === 'ALL'
          ? `/api/admin/moderation/queue`
          : `/api/admin/moderation/queue?status=${statusFilter}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setVideos(json.data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingVideos(false);
    }
  }, [statusFilter, token]);

  // Fetch creators
  const fetchCreators = useCallback(async () => {
    setIsLoadingCreators(true);
    try {
      const res = await fetch(`/api/admin/creators`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCreators(json.data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingCreators(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'videos') {
      fetchVideos();
    } else {
      fetchCreators();
    }
  }, [activeTab, fetchVideos, fetchCreators]);

  // Moderation quick actions (Approve, or open modal for Observe/Reject/Hide)
  const handleModerateAction = async (
    id: string,
    action: 'APPROVE' | 'REJECT' | 'OBSERVE' | 'HIDE',
    reason?: string,
    internalNotes?: string
  ) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/moderation/${id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          reason: reason || (action === 'APPROVE' ? 'Aprobado por el equipo editorial' : 'Moderado por administración'),
          internalNotes: internalNotes || undefined,
        }),
      });

      if (res.ok) {
        // Refresh videos list
        fetchVideos();
      }
    } catch {
      // ignore
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenActionModal = (videoId: string, action: 'OBSERVE' | 'REJECT' | 'HIDE') => {
    const titles = {
      OBSERVE: 'Observar Video (Solicitar Corrección)',
      REJECT: 'Rechazar Video',
      HIDE: 'Ocultar Video del Catálogo Público',
    };
    setActionModal({
      isOpen: true,
      videoId,
      action,
      title: titles[action],
      reason: '',
      internalNotes: '',
    });
  };

  const handleSubmitActionModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal.reason.trim()) return;

    await handleModerateAction(
      actionModal.videoId,
      actionModal.action,
      actionModal.reason.trim(),
      actionModal.internalNotes.trim() || undefined
    );

    setActionModal((prev) => ({ ...prev, isOpen: false, reason: '', internalNotes: '' }));
  };

  // Filtered lists
  const filteredVideos = useMemo(() => {
    const q = videoSearchQuery.toLowerCase().trim();
    return videos.filter((v) => {
      const matchesSearch =
        !q ||
        v.title.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q)) ||
        (v.creatorHandle && v.creatorHandle.toLowerCase().includes(q)) ||
        (v.creatorDisplayName && v.creatorDisplayName.toLowerCase().includes(q)) ||
        (v.externalCreatorHandle && v.externalCreatorHandle.toLowerCase().includes(q)) ||
        (v.externalCreatorDisplayName && v.externalCreatorDisplayName.toLowerCase().includes(q)) ||
        v.category.toLowerCase().includes(q) ||
        (v.localityId && v.localityId.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [videos, videoSearchQuery, statusFilter]);

  const filteredCreators = useMemo(() => {
    const q = creatorSearchQuery.toLowerCase().trim();
    if (!q) return creators;
    return creators.filter(
      (c) =>
        c.handle.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q) ||
        (c.bio && c.bio.toLowerCase().includes(q))
    );
  }, [creators, creatorSearchQuery]);

  const statusBadge = (status: ModerationStatus) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <Check className="w-3 h-3" /> APROBADO
          </span>
        );
      case 'PENDING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> PENDIENTE
          </span>
        );
      case 'OBSERVED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
            OBSERVADO
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
            <X className="w-3 h-3" /> RECHAZADO
          </span>
        );
      case 'HIDDEN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1">
            <EyeOff className="w-3 h-3" /> OCULTO
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PlaySquare className="w-5 h-5 text-[#E85B49]" />
            Gestión de Videos y Creadores
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro, moderación editorial de videos sociales (TikTok, Reels, Shorts) y directorio de creadores turísticos
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('videos')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'videos'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-[#E85B49]" />
            <span>Videos ({videos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('creators')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'creators'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#E85B49]" />
            <span>Creadores ({creators.length})</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: VIDEOS MANAGEMENT & MODERATION */}
      {/* ============================================================== */}
      {activeTab === 'videos' && (
        <div className="space-y-6">
          {/* Controls Bar: Search, Filters, and New Video Button */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-1 flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por título, creador o lugar..."
                  value={videoSearchQuery}
                  onChange={(e) => setVideoSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-500 whitespace-nowrap">Estado:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E85B49] font-medium"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="PENDING">Pendientes de Revisión</option>
                  <option value="APPROVED">Aprobados (En Vivo)</option>
                  <option value="OBSERVED">Observados</option>
                  <option value="REJECTED">Rechazados</option>
                  <option value="HIDDEN">Ocultos</option>
                </select>
              </div>

              <button
                onClick={fetchVideos}
                title="Actualizar listado"
                className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingVideos ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <button
              onClick={() => {
                setEditingVideo(undefined);
                setIsVideoModalOpen(true);
              }}
              className="px-4 py-2 bg-[#E85B49] hover:bg-[#d64f3e] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Video</span>
            </button>
          </div>

          {/* Videos Grid */}
          {isLoadingVideos ? (
            <div className="p-16 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#E85B49]" />
              <span>Consultando catálogo de videos...</span>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-16 text-center space-y-3">
              <Video className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm font-semibold text-slate-700">No se encontraron videos</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No hay videos que coincidan con los filtros aplicados o aún no se han registrado videos en el catálogo.
              </p>
              <button
                onClick={() => {
                  setEditingVideo(undefined);
                  setIsVideoModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#E85B49] bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Registrar el primer video
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredVideos.map((sub) => {
                const isProcessing = processingId === sub.id;

                return (
                  <div
                    key={sub.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-all"
                  >
                    <div>
                      {/* Video Thumbnail & Platform Badges */}
                      <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden group">
                        {sub.thumbnailUrl ? (
                          <img
                            src={sub.thumbnailUrl}
                            alt={sub.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <Video className="w-10 h-10 text-slate-600" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                        {/* Top Badges */}
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-black/80 text-white font-mono text-[10px] uppercase font-bold tracking-wider">
                            {sub.platform}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-black/60 text-slate-200 font-mono text-[10px] uppercase">
                            {sub.contentType}
                          </span>
                        </div>

                        <div className="absolute top-2 right-2">
                          {statusBadge(sub.status)}
                        </div>

                        {/* Direct Play/Watch link on image */}
                        <a
                          href={sub.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute bottom-2 right-2 px-2 py-1 bg-black/75 hover:bg-black text-white text-[10px] rounded flex items-center gap-1 font-medium transition-colors"
                        >
                          <span>Ver enlace original</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      {/* Video Content Details */}
                      <div className="p-4 space-y-2.5">
                        {/* Creator Info Header */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate" title={resolveCreatorLabel(sub)}>
                              {resolveCreatorLabel(sub)}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 capitalize">
                            {sub.localityId || 'La Libertad'}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-xs line-clamp-2 leading-snug">
                          {sub.title}
                        </h3>

                        {sub.description && (
                          <p className="text-slate-500 text-[11px] line-clamp-2 leading-relaxed">
                            {sub.description}
                          </p>
                        )}

                        {/* Associated Places Chips */}
                        <div className="pt-1">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#E85B49]" /> Lugares Vinculados:
                          </div>
                          {sub.places && sub.places.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {sub.places.map((vp) => {
                                const placeInfo = placesMap.get(vp.placeId);
                                return (
                                  <span
                                    key={vp.placeId}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${
                                      vp.isPrimary
                                        ? 'bg-[#E85B49]/10 text-[#E85B49] border-[#E85B49]/30 font-semibold'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                    title={placeInfo ? `${placeInfo.name} (${placeInfo.localityId})` : vp.placeId}
                                  >
                                    {vp.isPrimary && <Sparkles className="w-2.5 h-2.5" />}
                                    <span className="truncate max-w-[150px]">
                                      {placeInfo ? placeInfo.name : vp.placeId}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Sin lugares asociados
                            </span>
                          )}
                        </div>

                        {/* Moderation Notes if Observed/Rejected */}
                        {sub.moderationNotes && (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                            <span className="font-bold">Observación:</span> {sub.moderationNotes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-2">
                      {/* Primary Actions based on current status */}
                      <div className="flex items-center gap-1.5">
                        {sub.status !== 'APPROVED' && (
                          <button
                            onClick={() => handleModerateAction(sub.id, 'APPROVE')}
                            disabled={isProcessing}
                            title="Aprobar para publicación inmediata"
                            className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Aprobar</span>
                          </button>
                        )}

                        {sub.status !== 'OBSERVED' && (
                          <button
                            onClick={() => handleOpenActionModal(sub.id, 'OBSERVE')}
                            disabled={isProcessing}
                            title="Observar y solicitar corrección"
                            className="flex-1 py-1 px-2 bg-white border border-yellow-300 text-yellow-800 hover:bg-yellow-50 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />
                            <span>Observar</span>
                          </button>
                        )}

                        {sub.status !== 'REJECTED' && (
                          <button
                            onClick={() => handleOpenActionModal(sub.id, 'REJECT')}
                            disabled={isProcessing}
                            title="Rechazar publicación"
                            className="flex-1 py-1 px-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Rechazar</span>
                          </button>
                        )}

                        {sub.status === 'APPROVED' && (
                          <button
                            onClick={() => handleOpenActionModal(sub.id, 'HIDE')}
                            disabled={isProcessing}
                            title="Ocultar del público sin eliminar"
                            className="flex-1 py-1 px-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Ocultar</span>
                          </button>
                        )}
                      </div>

                      {/* Secondary Management: Edit & Audit History */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                        <button
                          onClick={() => {
                            setEditingVideo(sub);
                            setIsVideoModalOpen(true);
                          }}
                          className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3 text-slate-400" />
                          <span>Editar Metadatos / Lugares</span>
                        </button>

                        <button
                          onClick={() => setHistoryVideo({ id: sub.id, title: sub.title })}
                          className="text-slate-600 hover:text-[#E85B49] font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <History className="w-3 h-3" />
                          <span>Historial</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: CREATOR DIRECTORY MANAGEMENT */}
      {/* ============================================================== */}
      {activeTab === 'creators' && (
        <div className="space-y-6">
          {/* Controls Bar: Search and New Creator Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por handle, nombre o bio..."
                value={creatorSearchQuery}
                onChange={(e) => setCreatorSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchCreators}
                title="Actualizar creadores"
                className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCreators ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => {
                  setEditingCreator(undefined);
                  setIsCreatorModalOpen(true);
                }}
                className="px-4 py-2 bg-[#E85B49] hover:bg-[#d64f3e] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Creador</span>
              </button>
            </div>
          </div>

          {/* Creators Directory Grid */}
          {isLoadingCreators ? (
            <div className="p-16 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#E85B49]" />
              <span>Cargando directorio de creadores...</span>
            </div>
          ) : filteredCreators.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-16 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm font-semibold text-slate-700">No hay perfiles de creador</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No se encontraron perfiles de creador registrados. Registra nuevos creadores para asociarlos a videos de la región.
              </p>
              <button
                onClick={() => {
                  setEditingCreator(undefined);
                  setIsCreatorModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#E85B49] bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Registrar Creador
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCreators.map((creator) => (
                <div
                  key={creator.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div className="space-y-4">
                    {/* Header: Avatar, Name, Handle, Verification */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                          {creator.avatarUrl ? (
                            <img
                              src={creator.avatarUrl}
                              alt={creator.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            creator.displayName.slice(0, 2).toUpperCase()
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-1">
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">
                              {creator.displayName}
                            </h4>
                            {creator.isVerified && (
                              <span title="Creador Verificado">
                                <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-mono text-slate-500">
                            @{creator.handle}
                          </span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-slate-100 text-slate-700">
                        {creator.primaryPlatform}
                      </span>
                    </div>

                    {/* Bio */}
                    {creator.bio && (
                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        {creator.bio}
                      </p>
                    )}

                    {/* Social Links & Metrics */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        {creator.tiktokUrl && (
                          <a
                            href={creator.tiktokUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-black transition-colors"
                            title="TikTok"
                          >
                            TikTok
                          </a>
                        )}
                        {creator.instagramUrl && (
                          <a
                            href={creator.instagramUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-pink-600 transition-colors"
                            title="Instagram"
                          >
                            Instagram
                          </a>
                        )}
                        {creator.youtubeUrl && (
                          <a
                            href={creator.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-red-600 transition-colors"
                            title="YouTube"
                          >
                            YouTube
                          </a>
                        )}
                      </div>

                      <span className="font-mono text-[11px] font-semibold text-slate-700">
                        {creator.totalApprovedVideos} videos aprobados
                      </span>
                    </div>

                    {/* Audience Breakdown */}
                    {(typeof creator.tiktokFollowers === 'number' ||
                      typeof creator.instagramFollowers === 'number' ||
                      typeof creator.youtubeSubscribers === 'number') && (
                      <div className="pt-2.5 pb-1 border-t border-slate-100 space-y-1 bg-slate-50/60 -mx-5 px-5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-700 font-medium">
                          {typeof creator.tiktokFollowers === 'number' && (
                            <span>
                              <strong>{creator.tiktokFollowers.toLocaleString('es-PE')}</strong> seguidores TikTok
                            </span>
                          )}
                          {typeof creator.instagramFollowers === 'number' && (
                            <span>
                              <strong>{creator.instagramFollowers.toLocaleString('es-PE')}</strong> seguidores Instagram
                            </span>
                          )}
                          {typeof creator.youtubeSubscribers === 'number' && (
                            <span>
                              <strong>{creator.youtubeSubscribers.toLocaleString('es-PE')}</strong> suscriptores YouTube
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                          Datos declarados por el creador o administrador
                          {creator.audienceUpdatedAt && (
                            <span> · Act. {new Date(creator.audienceUpdatedAt).toLocaleDateString('es-PE')}</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      Registrado el {new Date(creator.createdAt).toLocaleDateString('es-PE')}
                    </span>

                    <button
                      onClick={() => {
                        setEditingCreator(creator);
                        setIsCreatorModalOpen(true);
                      }}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-3 h-3 text-slate-400" />
                      <span>Editar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: VIDEO REGISTRATION / EDIT */}
      {/* ============================================================== */}
      <VideoEditorModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        initialVideo={editingVideo}
        creators={creators}
        onVideoSaved={() => {
          fetchVideos();
        }}
      />

      {/* ============================================================== */}
      {/* MODAL: CREATOR PROFILE REGISTRATION / EDIT */}
      {/* ============================================================== */}
      <CreatorEditorModal
        isOpen={isCreatorModalOpen}
        onClose={() => setIsCreatorModalOpen(false)}
        initialCreator={editingCreator}
        onCreatorSaved={() => {
          fetchCreators();
        }}
      />

      {/* ============================================================== */}
      {/* MODAL: VIDEO AUDIT HISTORY */}
      {/* ============================================================== */}
      {historyVideo && (
        <VideoHistoryModal
          isOpen={!!historyVideo}
          onClose={() => setHistoryVideo(null)}
          videoId={historyVideo.id}
          videoTitle={historyVideo.title}
        />
      )}

      {/* ============================================================== */}
      {/* MODAL: REASON & INTERNAL NOTES PROMPT (Observe / Reject / Hide) */}
      {/* ============================================================== */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-slate-800">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#E85B49]" />
                {actionModal.title}
              </h3>
              <button
                onClick={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitActionModal} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo / Observación <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={actionModal.reason}
                  onChange={(e) =>
                    setActionModal((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder={
                    actionModal.action === 'OBSERVE'
                      ? 'Explica qué debe corregir el creador o por qué se observa el contenido...'
                      : 'Especifica la justificación para rechazar u ocultar el contenido...'
                  }
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nota interna (Opcional, sólo visible para administradores)
                </label>
                <input
                  type="text"
                  value={actionModal.internalNotes}
                  onChange={(e) =>
                    setActionModal((prev) => ({ ...prev, internalNotes: e.target.value }))
                  }
                  placeholder="Detalles adicionales para registro de auditoría"
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#E85B49] hover:bg-[#d64f3e] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Confirmar Acción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
