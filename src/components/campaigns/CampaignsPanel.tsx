import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Award,
  Video,
  Plus,
  Sparkles,
  Search,
  Filter,
  Calendar,
  MapPin,
  ExternalLink,
  ThumbsUp,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  Share2,
  Clock
} from 'lucide-react';
import { LocalCampaign, CampaignSubmission } from '../../types/catalog.ts';
import { LA_LIBERTAD_LOCALITIES } from '../../types/geo.ts';

interface CampaignsPanelProps {
  onOpenAiAssistant: (initialPrompt?: string) => void;
  tripStartDate?: string;
  tripEndDate?: string;
  destinationId?: string;
}

export const CampaignsPanel: React.FC<CampaignsPanelProps> = ({
  onOpenAiAssistant,
  tripStartDate,
  tripEndDate,
  destinationId,
}) => {
  const [campaigns, setCampaigns] = useState<LocalCampaign[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters: Place & Date Range
  const [selectedLocality, setSelectedLocality] = useState<string>(destinationId || 'todas');
  const [filterStartDate, setFilterStartDate] = useState<string>(tripStartDate || '');
  const [filterEndDate, setFilterEndDate] = useState<string>(tripEndDate || '');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedCampaignForSubmission, setSelectedCampaignForSubmission] = useState<LocalCampaign | null>(null);

  // Submission Form State
  const [subCreatorName, setSubCreatorName] = useState<string>('');
  const [subCreatorHandle, setSubCreatorHandle] = useState<string>('');
  const [subPlatform, setSubPlatform] = useState<'tiktok' | 'reels' | 'shorts'>('tiktok');
  const [subVideoUrl, setSubVideoUrl] = useState<string>('');
  const [subTitle, setSubTitle] = useState<string>('');
  const [subCaption, setSubCaption] = useState<string>('');
  const [submittingVideo, setSubmittingVideo] = useState<boolean>(false);

  // Campaign Form State
  const [newTitle, setNewTitle] = useState<string>('');
  const [newBusinessName, setNewBusinessName] = useState<string>('');
  const [newLocalityId, setNewLocalityId] = useState<string>(destinationId || 'trujillo');
  const [newStartDate, setNewStartDate] = useState<string>(tripStartDate || '2026-11-01');
  const [newEndDate, setNewEndDate] = useState<string>(tripEndDate || '2026-12-15');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newVideoBrief, setNewVideoBrief] = useState<string>('');
  const [creatingCampaign, setCreatingCampaign] = useState<boolean>(false);

  // Fetch campaigns
  const fetchCampaigns = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (selectedLocality && selectedLocality !== 'todas') params.set('localityId', selectedLocality);
    if (filterStartDate) params.set('startDate', filterStartDate);
    if (filterEndDate) params.set('endDate', filterEndDate);
    if (searchQuery) params.set('q', searchQuery);

    fetch(`/api/campaigns?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setCampaigns(data.data);
        } else {
          setError('No se pudieron cargar las campañas locales.');
        }
      })
      .catch((err) => {
        console.error(err);
        setError('Error de conexión al cargar campañas.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCampaigns();
  }, [selectedLocality, filterStartDate, filterEndDate]);

  // Vote for a video submission
  const handleVote = async (campaignId: string, submissionId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/submissions/${submissionId}/vote`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        // Optimistic UI update
        setCampaigns((prev) =>
          prev.map((camp) => {
            if (camp.id !== campaignId) return camp;
            const updatedSubs = camp.submissions.map((sub) =>
              sub.id === submissionId ? { ...sub, votesCount: data.newVotes } : sub
            );
            return {
              ...camp,
              submissions: updatedSubs.sort((a, b) => b.votesCount - a.votesCount),
            };
          })
        );
      }
    } catch (err) {
      console.error('Error al votar:', err);
    }
  };

  // Submit Video for Campaign
  const handleSubmitVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignForSubmission || !subCreatorName || !subVideoUrl || !subTitle) return;

    setSubmittingVideo(true);
    try {
      const res = await fetch(`/api/campaigns/${selectedCampaignForSubmission.id}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorName: subCreatorName,
          creatorHandle: subCreatorHandle.startsWith('@') ? subCreatorHandle : `@${subCreatorHandle}`,
          platform: subPlatform,
          videoUrl: subVideoUrl,
          title: subTitle,
          caption: subCaption,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedCampaignForSubmission(null);
        setSubCreatorName('');
        setSubCreatorHandle('');
        setSubVideoUrl('');
        setSubTitle('');
        setSubCaption('');
        fetchCampaigns();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingVideo(false);
    }
  };

  // Create Campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newBusinessName || !newStartDate || !newEndDate) return;

    setCreatingCampaign(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          businessName: newBusinessName,
          localityId: newLocalityId,
          startDate: newStartDate,
          endDate: newEndDate,
          description: newDescription,
          videoBrief: newVideoBrief,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsCreateModalOpen(false);
        setNewTitle('');
        setNewBusinessName('');
        setNewDescription('');
        setNewVideoBrief('');
        fetchCampaigns();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingCampaign(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* ========================================================
          HERO BANNER: PAQUETE DE CAMPAÑAS PARA LOCALES Y CREADORES
      ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#17243A] via-[#1E293B] to-[#0F172A] p-6 sm:p-8 text-white shadow-xl border border-white/10">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-[#E05A47]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E05A47]/20 text-[#FF8573] border border-[#E05A47]/30 text-xs font-semibold tracking-wide uppercase">
              <Trophy className="w-3.5 h-3.5" />
              <span>Paquete para Negocios Locales & Creadores</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-['Outfit']">
              Impulsa tu Local con Videos Virales de Creadores
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Los negocios de La Libertad (restaurantes, hoteles, artesanía y agencias) publican desafíos en video (TikTok / Reels). Los creadores participan, difunden la experiencia y la comunidad vota por los mejores.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#E05A47] hover:bg-[#D04936] text-white text-sm font-semibold shadow-lg shadow-[#E05A47]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Campaña de mi Local</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onOpenAiAssistant(
                  'Ayúdame a redactar un guión viral de 30 segundos (Reels/TikTok) para promocionar mi negocio local en La Libertad y ganar el concurso de creadores con los premios a los 3 primeros puestos.'
                )
              }
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#F59E0B]" />
              <span>Guión con IA (10 gratis)</span>
            </button>
          </div>
        </div>

        {/* PODIO DE PREMIOS OFICIALES PARA LOS 3 PRIMEROS PUESTOS */}
        <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-4 border border-amber-400/30 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold text-lg shrink-0">
              🥇
            </div>
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-amber-300">1º Puesto — Oro</div>
              <div className="text-base font-extrabold text-white">S/ 1,500 en Efectivo</div>
              <p className="text-xs text-slate-300 mt-1">Trofeo Oficial RIYMO + Difusión destacada regional.</p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-4 border border-slate-300/30 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-300/20 text-slate-200 flex items-center justify-center font-bold text-lg shrink-0">
              🥈
            </div>
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-slate-300">2º Puesto — Plata</div>
              <div className="text-base font-extrabold text-white">S/ 800 en Efectivo</div>
              <p className="text-xs text-slate-300 mt-1">Cena degustación para 2 personas en el local + Certificado.</p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-4 border border-amber-600/30 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-600/20 text-amber-400 flex items-center justify-center font-bold text-lg shrink-0">
              🥉
            </div>
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-amber-400">3º Puesto — Bronce</div>
              <div className="text-base font-extrabold text-white">S/ 400 en Efectivo</div>
              <p className="text-xs text-slate-300 mt-1">Canasta gourmet con postres y productos tradicionales de La Libertad.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          BARRA DE FILTRADO DE LUGAR Y FECHA RANGO
      ======================================================== */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E9EEF4] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#E05A47]" />
            <h2 className="text-sm font-bold text-[#17243A]">Filtros de Campaña</h2>
            <span className="text-xs text-[#64748B]">({campaigns.length} disponibles)</span>
          </div>

          {/* Buscador de texto */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchCampaigns()}
              placeholder="Buscar por local (ej. El Rincón de Vallejo, Big Ben)..."
              className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#1E293B] focus:outline-hidden focus:border-[#E05A47]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#F1F5F9]">
          {/* 1. Filtrado de Lugar */}
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#E05A47]" />
              <span>Filtrar por Lugar / Localidad</span>
            </label>
            <select
              value={selectedLocality}
              onChange={(e) => setSelectedLocality(e.target.value)}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#1E293B] focus:outline-hidden focus:border-[#E05A47] font-medium"
            >
              <option value="todas">Todas las localidades de La Libertad</option>
              {LA_LIBERTAD_LOCALITIES.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.province})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Filtrado de Fecha Inicio (Rango) */}
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#E05A47]" />
              <span>Fecha Rango Desde</span>
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#1E293B] focus:outline-hidden focus:border-[#E05A47] font-mono"
            />
          </div>

          {/* 3. Filtrado de Fecha Fin (Rango) */}
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#E05A47]" />
              <span>Fecha Rango Hasta</span>
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#1E293B] focus:outline-hidden focus:border-[#E05A47] font-mono"
            />
          </div>
        </div>
      </div>

      {/* ========================================================
          LISTA DE CAMPAÑAS ACTIVAS Y LEADERBOARD DE CREADORES
      ======================================================== */}
      {loading ? (
        <div className="p-12 text-center text-sm text-[#64748B] bg-white rounded-xl border border-[#E9EEF4]">
          Cargando campañas oficiales de negocios locales...
        </div>
      ) : error ? (
        <div className="p-6 text-center text-sm text-red-600 bg-red-50 rounded-xl border border-red-200">
          {error}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-[#E9EEF4] space-y-3">
          <AlertCircle className="w-8 h-8 text-[#94A3B8] mx-auto" />
          <h3 className="text-base font-bold text-[#17243A]">No se encontraron campañas para los filtros seleccionados</h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">
            Prueba cambiando la localidad o ampliando el rango de fechas para ver otros locales participantes.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedLocality('todas');
              setFilterStartDate('');
              setFilterEndDate('');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-xs font-semibold rounded-lg text-[#1E293B] cursor-pointer"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {campaigns.map((camp) => (
            <div
              key={camp.id}
              className="bg-white rounded-2xl border border-[#E9EEF4] shadow-sm overflow-hidden hover:border-[#CBD5E1] transition-all"
            >
              {/* Cabecera de la Campaña del Local */}
              <div className="p-5 sm:p-6 border-b border-[#F1F5F9] bg-[#F8FAFC]/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#E05A47]/10 text-[#E05A47] text-xs font-bold">
                      {camp.businessName}
                    </span>
                    <span className="text-xs text-[#64748B] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#E05A47]" />
                      <span className="capitalize">{camp.localityId.replace('_', ' ')}</span>
                    </span>
                    <span className="text-xs text-[#64748B] flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-[#64748B]" />
                      <span>{camp.startDate} al {camp.endDate}</span>
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#17243A] font-['Outfit']">
                    {camp.title}
                  </h2>
                  <p className="text-xs text-[#475569] leading-relaxed max-w-3xl">
                    {camp.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedCampaignForSubmission(camp)}
                    className="px-3.5 py-2 rounded-lg bg-[#17243A] hover:bg-[#0F172A] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5 text-[#E05A47]" />
                    <span>Postular mi Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenAiAssistant(
                        `Escribe un guión de video creativo de 30 segundos para ${camp.businessName} en ${camp.localityId}. El desafío es: "${camp.videoBrief}". Incluye gancho, tomas visuales y llamado al voto para quedar entre los 3 primeros puestos.`
                      )
                    }
                    className="px-3.5 py-2 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#1E293B] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    title="Generar guión con IA"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#E05A47]" />
                    <span className="hidden sm:inline">Guión IA</span>
                  </button>
                </div>
              </div>

              {/* Instrucciones y Hashtags */}
              <div className="px-5 py-3 bg-[#FAFAFA] border-b border-[#F1F5F9] flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[#17243A]">Etiquetas requeridas:</span>
                  {camp.hashtags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-white border border-[#E2E8F0] rounded-md font-mono text-[#0284C7]">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-[#059669] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Premios garantizados a los 3 primeros puestos</span>
                </div>
              </div>

              {/* LEADERBOARD DE CREADORES PARTICIPANTES */}
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-[#17243A]">
                      Ranking en Vivo de Creadores ({camp.submissions.length} videos participantes)
                    </h3>
                  </div>
                  <span className="text-xs text-[#64748B]">
                    La comunidad y el jurado deciden los 3 primeros puestos
                  </span>
                </div>

                {camp.submissions.length === 0 ? (
                  <div className="p-6 text-center bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1] space-y-2">
                    <Video className="w-6 h-6 text-[#94A3B8] mx-auto" />
                    <p className="text-xs font-semibold text-[#475569]">
                      ¡Sé el primer creador en postular un video para {camp.businessName}!
                    </p>
                    <p className="text-xs text-[#64748B]">
                      Sube tu video a TikTok, Instagram Reels o YouTube Shorts y registra el enlace para clasificar en el Top 3.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedCampaignForSubmission(camp)}
                      className="mt-2 px-3 py-1.5 bg-[#E05A47] text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Postular video ahora
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {camp.submissions.map((sub, index) => {
                      const rank = index + 1;
                      const isTop3 = rank <= 3;
                      const rankBadge =
                        rank === 1
                          ? { label: '1º Puesto — Oro', bg: 'bg-amber-100 text-amber-800 border-amber-300', emoji: '🥇' }
                          : rank === 2
                          ? { label: '2º Puesto — Plata', bg: 'bg-slate-100 text-slate-800 border-slate-300', emoji: '🥈' }
                          : rank === 3
                          ? { label: '3º Puesto — Bronce', bg: 'bg-orange-100 text-orange-800 border-orange-300', emoji: '🥉' }
                          : null;

                      return (
                        <div
                          key={sub.id}
                          className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
                            isTop3
                              ? 'bg-gradient-to-b from-white to-[#F8FAFC] border-amber-300/80 shadow-xs ring-1 ring-amber-400/20'
                              : 'bg-white border-[#E9EEF4]'
                          }`}
                        >
                          <div>
                            {/* Badges de posición */}
                            <div className="flex items-center justify-between mb-3">
                              {rankBadge ? (
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${rankBadge.bg}`}>
                                  <span>{rankBadge.emoji}</span>
                                  <span>{rankBadge.label}</span>
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-[#64748B]">Puesto #{rank}</span>
                              )}
                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-[#F1F5F9] rounded text-[#64748B]">
                                {sub.platform}
                              </span>
                            </div>

                            {/* Miniatura y título */}
                            <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 mb-3 group">
                              <img
                                src={sub.thumbnailUrl}
                                alt={sub.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                              <a
                                href={sub.videoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="absolute bottom-2 right-2 px-2.5 py-1 rounded bg-black/70 hover:bg-black text-white text-[10px] font-semibold flex items-center gap-1 backdrop-blur-xs"
                              >
                                <span>Ver video</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>

                            <h4 className="text-xs font-bold text-[#17243A] line-clamp-1 mb-1">
                              {sub.title}
                            </h4>
                            <p className="text-[11px] text-[#64748B] line-clamp-2 mb-2">
                              {sub.caption}
                            </p>
                          </div>

                          {/* Footer del creador y botón de voto */}
                          <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
                            <div>
                              <div className="font-semibold text-[#1E293B]">{sub.creatorName}</div>
                              <div className="text-[10px] text-[#0284C7] font-mono">{sub.creatorHandle}</div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="text-xs font-bold text-[#17243A]">{sub.votesCount} votos</div>
                                <div className="text-[10px] text-[#94A3B8]">{sub.viewsCount.toLocaleString()} vistas</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleVote(camp.id, sub.id)}
                                className="p-2 rounded-lg bg-[#E05A47]/10 hover:bg-[#E05A47] text-[#E05A47] hover:text-white transition-colors cursor-pointer"
                                title="Votar por este video"
                              >
                                <ThumbsUp className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================
          MODAL: POSTULAR VIDEO DE CREADOR
      ======================================================== */}
      {selectedCampaignForSubmission && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E2E8F0] relative">
            <button
              type="button"
              onClick={() => setSelectedCampaignForSubmission(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 mb-5">
              <span className="text-xs font-bold text-[#E05A47] uppercase tracking-wider">
                {selectedCampaignForSubmission.businessName}
              </span>
              <h3 className="text-lg font-bold text-[#17243A]">Postular Video de Creador</h3>
              <p className="text-xs text-[#64748B]">
                Ingresa el enlace de tu video en TikTok o Reels para participar por los 3 primeros puestos (S/ 1,500, S/ 800 y S/ 400).
              </p>
            </div>

            <form onSubmit={handleSubmitVideo} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">Tu Nombre o Nombre de Creador</label>
                <input
                  type="text"
                  required
                  value={subCreatorName}
                  onChange={(e) => setSubCreatorName(e.target.value)}
                  placeholder="Ej. Valeria Quispe"
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] mb-1">Usuario / Handle</label>
                  <input
                    type="text"
                    required
                    value={subCreatorHandle}
                    onChange={(e) => setSubCreatorHandle(e.target.value)}
                    placeholder="@tu_usuario"
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] mb-1">Plataforma</label>
                  <select
                    value={subPlatform}
                    onChange={(e) => setSubPlatform(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs"
                  >
                    <option value="tiktok">TikTok</option>
                    <option value="reels">Instagram Reels</option>
                    <option value="shorts">YouTube Shorts</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">Enlace del Video Publicado</label>
                <input
                  type="url"
                  required
                  value={subVideoUrl}
                  onChange={(e) => setSubVideoUrl(e.target.value)}
                  placeholder="https://tiktok.com/@usuario/video/..."
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">Título del Video</label>
                <input
                  type="text"
                  required
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  placeholder="Ej. ¡Probando el mejor ceviche en Huanchaco!"
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">Descripción breve</label>
                <textarea
                  rows={2}
                  value={subCaption}
                  onChange={(e) => setSubCaption(e.target.value)}
                  placeholder="Cuenta qué experiencia mostraste en el video..."
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCampaignForSubmission(null)}
                  className="px-4 py-2 bg-[#F1F5F9] text-xs font-semibold text-[#64748B] rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingVideo}
                  className="px-4 py-2 bg-[#E05A47] hover:bg-[#D04936] text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
                >
                  {submittingVideo ? 'Registrando...' : 'Registrar Video al Concurso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CREAR CAMPAÑA PARA LOCAL
      ======================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E2E8F0] relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 mb-5">
              <span className="text-xs font-bold text-[#E05A47] uppercase tracking-wider">
                Para Negocios de La Libertad
              </span>
              <h3 className="text-lg font-bold text-[#17243A]">Crear Campaña con Creadores</h3>
              <p className="text-xs text-[#64748B]">
                Publica un desafío en video para que creadores generen contenido de tu local y atraigan visitantes.
              </p>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">Nombre de tu Local o Establecimiento</label>
                <input
                  type="text"
                  required
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  placeholder="Ej. Cevicheria Huanchaquera / Hotel Plaza"
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">Localidad de La Libertad</label>
                <select
                  value={newLocalityId}
                  onChange={(e) => setNewLocalityId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs"
                >
                  {LA_LIBERTAD_LOCALITIES.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.province})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">Título de la Campaña / Desafío</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ej. Desafío: El Mejor Ceviche frente al Muelle"
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] mb-1">Fecha de Cierre</label>
                  <input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">Descripción del Local</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Cuenta qué hace único a tu local en La Libertad..."
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">Desafío para el Video</label>
                <textarea
                  rows={2}
                  value={newVideoBrief}
                  onChange={(e) => setNewVideoBrief(e.target.value)}
                  placeholder="Qué deben mostrar los creadores (ej. plato estrella, vista panorámica, atención)..."
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
                <div className="font-bold">🏆 Premios a los 3 Primeros Puestos:</div>
                <div>• 1º Puesto: S/ 1,500 en efectivo + Trofeo Oficial</div>
                <div>• 2º Puesto: S/ 800 en efectivo + Cena degustación</div>
                <div>• 3º Puesto: S/ 400 en efectivo + Canasta regional</div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-[#F1F5F9] text-xs font-semibold text-[#64748B] rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingCampaign}
                  className="px-4 py-2 bg-[#E05A47] hover:bg-[#D04936] text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
                >
                  {creatingCampaign ? 'Publicando...' : 'Publicar Campaña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
