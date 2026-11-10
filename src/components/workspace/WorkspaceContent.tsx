import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Bookmark,
  Calendar,
  Trash2,
  ArrowUp,
  ArrowDown,
  MapPin,
  Star,
  ShieldCheck,
  ChevronRight,
  Phone,
  X,
  Compass,
  FileText,
  Info,
  Check
} from 'lucide-react';
import { Place, PlaceCategory, TripItinerary } from '../../types/catalog.ts';
import { generateDayList, TripDayItem } from '../../utils/dateUtils.ts';
import { WorkspaceSection } from './WorkspaceSidebar.tsx';
import { PlaceImage } from '../common/PlaceImage.tsx';
import {
  FILTER_CATEGORIES,
  LOCALITY_FILTER_OPTIONS,
  matchesCategory,
  matchesSearchQuery,
  matchesLocality,
} from '../../utils/filterUtils.ts';
import { ItineraryView } from './ItineraryView.tsx';
import { HorizontalScrollContainer } from '../common/HorizontalScrollContainer.tsx';

interface WorkspaceContentProps {
  trip: TripItinerary;
  places: Place[];
  selectedPlace: Place | null;
  onSelectPlace: (place: Place | null) => void;
  activeSection: WorkspaceSection;
  onSelectSection?: (section: WorkspaceSection) => void;
  selectedDayNumber: number | null;
  onSelectDayNumber: (day: number | null) => void;
  onAddPlaceToDay: (place: Place, dayNumber: number) => void;
  onToggleSavePlace: (placeId: string) => void;
  onRemoveActivity: (activityId: string) => void;
  onMoveActivityToDay: (activityId: string, targetDayNumber: number) => void;
  onMoveActivityPosition?: (activityId: string, targetDayNumber: number, targetIndex: number) => void;
  onReorderActivitiesForDay?: (dayNumber: number, orderedActivityIds: string[]) => void;
  onReorderActivity: (activityId: string, direction: 'up' | 'down') => void;
  onAddManualActivity: (dayNumber: number, title: string, timeSlot?: string, notes?: string) => void;
  onUpdateNotes: (notes: string) => void;
  isMapCollapsed?: boolean;
  previousSection?: WorkspaceSection | null;
  onReturnToPreviousSection?: () => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  selectedLocality?: string;
  onLocalityChange?: (locality: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const WorkspaceContent: React.FC<WorkspaceContentProps> = ({
  trip,
  places,
  selectedPlace,
  onSelectPlace,
  activeSection,
  onSelectSection,
  selectedDayNumber,
  onSelectDayNumber,
  onAddPlaceToDay,
  onToggleSavePlace,
  onRemoveActivity,
  onMoveActivityToDay,
  onMoveActivityPosition,
  onReorderActivitiesForDay,
  onReorderActivity,
  onAddManualActivity,
  onUpdateNotes,
  isMapCollapsed = false,
  previousSection,
  onReturnToPreviousSection,
  selectedCategory = 'todas',
  onCategoryChange,
  selectedLocality = 'todas',
  onLocalityChange,
  searchQuery = '',
  onSearchChange,
}) => {
  // Selector de día en ficha de tarjeta
  const [activeDayPickerPlaceId, setActiveDayPickerPlaceId] = useState<string | null>(null);

  // Formulario de actividad manual
  const [manualFormDay, setManualFormDay] = useState<number | null>(null);
  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualTime, setManualTime] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Ref para garantizar que cada sección comience desde arriba
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryContainerRef = useRef<HTMLDivElement>(null);
  const categoryButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const localityContainerRef = useRef<HTMLDivElement>(null);
  const localityButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeSection, trip.id]);

  // Mantener visible el filtro de categoría seleccionado al desplazarse
  useEffect(() => {
    if (selectedCategory === 'todas') {
      categoryContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      const activeChip = categoryButtonsRef.current.get(selectedCategory);
      if (activeChip && categoryContainerRef.current) {
        activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [selectedCategory]);

  // Mantener visible la localidad seleccionada al desplazarse
  useEffect(() => {
    if (selectedLocality === 'todas') {
      localityContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      const activeChip = localityButtonsRef.current.get(selectedLocality);
      if (activeChip && localityContainerRef.current) {
        activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [selectedLocality]);

  const dayItems: TripDayItem[] = useMemo(() => {
    return generateDayList(trip.startDate, trip.totalDays);
  }, [trip.startDate, trip.totalDays]);

  // Opciones de localidad con conteos dinámicos en tiempo real
  const localityOptionsWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of places) {
      const locId = p.localityId.toLowerCase();
      counts[locId] = (counts[locId] || 0) + 1;
    }
    return LOCALITY_FILTER_OPTIONS.map((loc) => ({
      ...loc,
      count: loc.id === 'todas' ? places.length : (counts[loc.id] || 0),
    }));
  }, [places]);

  const activeLocalityLabel = useMemo(() => {
    if (!selectedLocality || selectedLocality === 'todas') {
      return 'La Libertad';
    }
    const found = LOCALITY_FILTER_OPTIONS.find((l) => l.id === selectedLocality);
    return found ? found.name : trip.destinationName;
  }, [selectedLocality, trip.destinationName]);

  // Alternar (toggle) asignación de un lugar a un día específico
  const handleToggleDay = (place: Place, dayNumber: number) => {
    const existingActivity = trip.activities.find(
      (a) => a.placeId === place.id && a.dayNumber === dayNumber
    );

    if (existingActivity) {
      if (onRemoveActivity) {
        onRemoveActivity(existingActivity.id);
      }
    } else {
      onAddPlaceToDay(place, dayNumber);
    }
  };

  // Filtrado de lugares sincronizado con catálogo y mapa (categoría + búsqueda + localidad)
  const filteredPlaces = useMemo(() => {
    return places.filter((p) => {
      return (
        matchesCategory(p.category, selectedCategory) &&
        matchesSearchQuery(p, searchQuery) &&
        matchesLocality(p.localityId, selectedLocality)
      );
    });
  }, [places, selectedCategory, searchQuery, selectedLocality]);

  // Lugares guardados en la wishlist
  const savedPlaces = useMemo(() => {
    const savedIds = new Set(trip.savedPlaceIds || []);
    return places.filter((p) => savedIds.has(p.id));
  }, [places, trip.savedPlaceIds]);

  const handleCreateManual = (e: React.FormEvent, dayNum: number) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;
    onAddManualActivity(
      dayNum,
      manualTitle.trim(),
      manualTime.trim() || undefined,
      manualNotes.trim() || undefined
    );
    setManualTitle('');
    setManualTime('');
    setManualNotes('');
    setManualFormDay(null);
  };

  const containerWidthClass = isMapCollapsed
    ? 'w-full flex-1 min-w-0 max-w-full'
    : 'w-full md:w-[460px] lg:w-[480px] xl:w-[520px] flex-1 min-w-0';

  // ==========================================
  // SECCIÓN 1: RESUMEN (OVERVIEW)
  // ==========================================
  if (activeSection === 'overview') {
    return (
      <div
        ref={scrollContainerRef}
        className={`${containerWidthClass} h-full min-h-0 bg-white border-r border-[#E9EEF4] flex flex-col p-5 md:p-6 overflow-y-auto select-none`}
      >
        <div className="flex items-start justify-between mb-5 pb-4 border-b border-[#E9EEF4]">
          <div>
            <span className="text-[10px] font-bold text-[#E85B49] uppercase tracking-wider block mb-1">
              Resumen del viaje
            </span>
            <h2 className="text-xl font-bold font-display text-[#17243A]">
              {trip.title}
            </h2>
            <p className="text-xs text-[#64748B] mt-1">
              Destino: <strong className="text-[#17243A]">{trip.destinationName}</strong>, La Libertad · {trip.totalDays} días ({trip.totalNights} noches)
            </p>
          </div>
        </div>

        {/* Indicadores claros y diferenciados */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 bg-[#F7F8FA] rounded-xl border border-[#E9EEF4] text-center">
            <span className="text-lg font-bold font-mono text-[#E85B49] block">
              {trip.activities.length}
            </span>
            <span className="text-[11px] text-[#64748B] font-medium">Actividades</span>
          </div>
          <div className="p-3 bg-[#F7F8FA] rounded-xl border border-[#E9EEF4] text-center">
            <span className="text-lg font-bold font-mono text-[#D97706] block">
              {savedPlaces.length}
            </span>
            <span className="text-[11px] text-[#64748B] font-medium">Por visitar</span>
          </div>
          <div className="p-3 bg-[#F7F8FA] rounded-xl border border-[#E9EEF4] text-center">
            <span className="text-lg font-bold font-mono text-[#17243A] block">
              {places.length}
            </span>
            <span className="text-[11px] text-[#64748B] font-medium">Disponibles</span>
          </div>
        </div>

        {/* Guía del destino */}
        <div className="p-4 bg-[#F7F8FA] rounded-xl border border-[#E9EEF4] mb-5">
          <h3 className="text-xs font-bold text-[#17243A] mb-1">
            Planificación en {trip.destinationName}
          </h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Organiza tus visitas por zonas geográficas para optimizar traslados. Explora el catálogo, guarda los lugares que te interesen en «Por visitar» o asígnalos directamente a un día.
          </p>
        </div>

        {/* Fuentes Oficiales Verificadas */}
        <div className="p-4 bg-emerald-50/70 border border-emerald-200/90 rounded-xl mb-5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Datos Certificados de La Libertad</span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            Lugares verificados con inventarios de <strong>MINCETUR</strong> y cartografía georreferenciada de <strong>OpenStreetMap</strong>.
          </p>
        </div>

        {/* Desglose por días */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-[#17243A] uppercase tracking-wider mb-2">
            Desglose del Itinerario
          </h3>
          {dayItems.map((day) => {
            const count = trip.activities.filter((a) => a.dayNumber === day.dayNumber).length;
            return (
              <div
                key={day.dayNumber}
                className="flex items-center justify-between p-3 bg-white border border-[#E9EEF4] rounded-xl hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="text-xs font-semibold text-[#17243A]">{day.label}</div>
                  <div className="text-[11px] text-[#64748B]">{day.formattedDate}</div>
                </div>
                <span className="text-xs font-mono font-semibold text-[#17243A] bg-[#F7F8FA] px-2 py-0.5 rounded border border-[#E9EEF4]">
                  {count} {count === 1 ? 'actividad' : 'actividades'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // SECCIÓN 2: EXPLORAR (CATÁLOGO DE EXPERIENCIAS)
  // ==========================================
  if (activeSection === 'explore') {
    return (
      <div
        ref={scrollContainerRef}
        className={`${containerWidthClass} h-full min-h-0 bg-white border-r border-[#E9EEF4] flex flex-col overflow-hidden`}
      >
        {/* Cabecera de búsqueda con jerarquía turística premium */}
        <div className="p-3.5 sm:p-4 border-b border-[#E9EEF4] space-y-3 bg-white shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display text-[#17243A] tracking-tight leading-snug">
                Explorar {activeLocalityLabel}
              </h2>
              {/* Contador real de resultados */}
              <p className="text-xs text-[#64748B] mt-0.5">
                Mostrando {filteredPlaces.length} de {places.length} lugares disponibles
              </p>
            </div>

            {/* Indicador de lugares guardados más discreto */}
            {savedPlaces.length > 0 && (
              <button
                type="button"
                onClick={() => {}}
                className="flex items-center gap-1.5 text-[11px] font-medium text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1 rounded-lg shrink-0"
              >
                <Bookmark className="w-3 h-3 text-[#D97706] fill-[#D97706]" />
                <span>{savedPlaces.length} guardados</span>
              </button>
            )}
          </div>

          {/* Buscador de ancho completo con altura táctil cómoda */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={`Buscar en ${activeLocalityLabel} (ceviche, huacas, surf, museos)...`}
              className="w-full h-11 sm:h-10 pl-10 pr-9 text-xs sm:text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[#17243A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#E85B49] focus:ring-2 focus:ring-[#E85B49]/15 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange?.('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Selector de Localidades de La Libertad (filtro no destructivo) */}
          <HorizontalScrollContainer
            innerRef={localityContainerRef}
            containerClassName="w-full"
            className="gap-1.5 pt-0.5 pb-0.5"
            gradientTheme="white"
            ariaLabel="Filtros de localidad"
          >
            {localityOptionsWithCounts.map((loc) => {
              const isLocActive = (selectedLocality || 'todas') === loc.id;
              return (
                <button
                  ref={(el) => {
                    if (el) localityButtonsRef.current.set(loc.id, el);
                    else localityButtonsRef.current.delete(loc.id);
                  }}
                  key={loc.id}
                  type="button"
                  onClick={() => onLocalityChange?.(loc.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 flex-shrink-0 font-medium flex items-center gap-1.5 ${
                    isLocActive
                      ? 'bg-[#E85B49] text-white shadow-xs font-semibold'
                      : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] border border-[#E2E8F0]/80'
                  }`}
                  title={`Filtrar por ${loc.name} (${loc.count} lugares)`}
                >
                  <MapPin className={`w-3 h-3 ${isLocActive ? 'text-white' : 'text-[#E85B49]'}`} />
                  <span>{loc.name}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full leading-tight font-semibold ${
                      isLocActive
                        ? 'bg-white/25 text-white'
                        : 'bg-[#E2E8F0] text-[#64748B]'
                    }`}
                  >
                    {loc.count}
                  </span>
                </button>
              );
            })}
          </HorizontalScrollContainer>

          {/* Separación visual y Chips de Categorías deslizables con soporte táctil fluido, degradados y flechas en desktop */}
          <HorizontalScrollContainer
            innerRef={categoryContainerRef}
            containerClassName="w-full"
            className="gap-1.5 pt-0.5 pb-0.5"
            gradientTheme="white"
            ariaLabel="Filtros de categoría"
          >
            {FILTER_CATEGORIES.map((cat) => (
              <button
                ref={(el) => {
                  if (el) categoryButtonsRef.current.set(cat.id, el);
                  else categoryButtonsRef.current.delete(cat.id);
                }}
                key={cat.id}
                type="button"
                onClick={() => onCategoryChange?.(cat.id)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 flex-shrink-0 font-medium flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-[#17243A] text-white shadow-xs font-semibold'
                    : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] border border-[#E2E8F0]/80'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </HorizontalScrollContainer>
        </div>

        {/* Vista Detallada de un Lugar (cuando está seleccionado) */}
        {selectedPlace ? (
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 bg-[#F8FAFC]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectPlace(null)}
                  className="text-xs text-[#64748B] hover:text-[#17243A] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  ← Volver al catálogo
                </button>
                {previousSection && previousSection !== 'explore' && onReturnToPreviousSection && (
                  <>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={onReturnToPreviousSection}
                      className="text-xs text-[#E85B49] hover:underline font-medium cursor-pointer"
                    >
                      Volver a {previousSection === 'overview' ? 'Resumen' : previousSection === 'itinerary' ? 'Itinerario' : previousSection === 'saved' ? 'Por visitar' : 'Notas'}
                    </button>
                  </>
                )}
              </div>
              {selectedPlace.verification.isVerified && (
                <span className="text-[10px] text-[#27856C] bg-[#27856C]/10 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {selectedPlace.verification.verificationLevel === 'official_mincetur'
                    ? 'MINCETUR Oficial'
                    : 'Verificado'}
                </span>
              )}
            </div>

            <div className="bg-white rounded-xl border border-[#E9EEF4] overflow-hidden shadow-xs">
              {/* Fotografía de alta calidad con PlaceImage y fallback editorial */}
              <div className="relative h-44 sm:h-52 bg-slate-100">
                <PlaceImage
                  src={selectedPlace.images[0]?.url}
                  alt={selectedPlace.name}
                  category={selectedPlace.category}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <h3 className="text-base font-bold font-display text-[#17243A]">
                    {selectedPlace.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[#64748B]">
                    {selectedPlace.rating && (
                      <div className="flex items-center gap-1 text-amber-600 font-semibold">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>{selectedPlace.rating}</span>
                      </div>
                    )}
                    <span>·</span>
                    <span className="capitalize">{selectedPlace.category}</span>
                    <span>·</span>
                    <span>{selectedPlace.localityName}</span>
                  </div>
                </div>

                <p className="text-xs text-[#475569] leading-relaxed">
                  {selectedPlace.fullDescription || selectedPlace.shortDescription}
                </p>

                <div className="pt-2 border-t border-[#E9EEF4] space-y-1.5 text-xs text-[#64748B]">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-[#E85B49]" />
                    <span>{selectedPlace.address}</span>
                  </div>
                  {selectedPlace.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{selectedPlace.phone}</span>
                    </div>
                  )}
                  {selectedPlace.sources?.[0] && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
                      <Info className="w-3 h-3 text-slate-400" />
                      <span>Fuente: {selectedPlace.sources[0].sourceId.replace('_', ' ').toUpperCase()}</span>
                    </div>
                  )}
                </div>

                {/* Acciones de la Ficha adaptadas para mobile */}
                <div className="pt-3 border-t border-[#E9EEF4] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleSavePlace(selectedPlace.id)}
                    className="p-2.5 border border-[#E2E8F0] rounded-xl text-[#17243A] hover:bg-[#F8FAFC] active:scale-95 transition-all cursor-pointer"
                    title={
                      trip.savedPlaceIds?.includes(selectedPlace.id)
                        ? 'Quitar de lugares para visitar'
                        : 'Guardar en lugares para visitar'
                    }
                  >
                    <Bookmark
                      className={`w-4 h-4 ${
                        trip.savedPlaceIds?.includes(selectedPlace.id)
                          ? 'fill-[#D97706] text-[#D97706]'
                          : 'text-[#64748B]'
                      }`}
                    />
                  </button>

                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="text-xs text-[#64748B] shrink-0 font-medium">Añadir a:</span>
                    <HorizontalScrollContainer
                      containerClassName="flex-1 min-w-0"
                      className="gap-1.5 py-0.5"
                      gradientTheme="slate"
                      arrowSize="sm"
                      ariaLabel="Asignar lugar a día"
                    >
                      {dayItems.map((d) => {
                        const isAlreadyInDay = trip.activities.some(
                          (a) => a.placeId === selectedPlace.id && a.dayNumber === d.dayNumber
                        );
                        return (
                          <button
                            key={d.dayNumber}
                            type="button"
                            onClick={() => handleToggleDay(selectedPlace, d.dayNumber)}
                            className={`px-3 py-1.5 text-xs rounded-lg font-mono font-semibold shrink-0 flex-shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                              isAlreadyInDay
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                                : 'bg-[#17243A] text-white hover:bg-[#E85B49] active:scale-95 shadow-2xs'
                            }`}
                            title={isAlreadyInDay ? `Día ${d.dayNumber} asignado (Pulsar para desasignar)` : `Añadir a Día ${d.dayNumber}`}
                          >
                            {isAlreadyInDay ? `✓ Día ${d.dayNumber}` : `Día ${d.dayNumber}`}
                          </button>
                        );
                      })}
                    </HorizontalScrollContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Lista de Tarjetas de Lugares adaptadas al ancho móvil */
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            <div className={`grid grid-cols-1 ${isMapCollapsed ? 'md:grid-cols-2 xl:grid-cols-3' : ''} gap-3`}>
              {filteredPlaces.map((place) => {
                const isSaved = trip.savedPlaceIds?.includes(place.id);
                const placeActivities = trip.activities.filter((a) => a.placeId === place.id);
                const isDayPickerOpen = activeDayPickerPlaceId === place.id;

                return (
                  <div
                    key={place.id}
                    onClick={() => onSelectPlace(place)}
                    className="bg-white rounded-xl border border-[#E9EEF4] hover:border-[#CBD5E1] p-3 sm:p-3.5 transition-all cursor-pointer group flex flex-col justify-between shadow-2xs hover:shadow-xs"
                  >
                    <div>
                      <div className="flex gap-3">
                        {/* Thumbnail equilibrado para pantallas móviles */}
                        <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-100">
                          <PlaceImage
                            src={place.images[0]?.url}
                            alt={place.name}
                            category={place.category}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-1.5">
                              <h4 className="text-xs sm:text-sm font-bold text-[#17243A] group-hover:text-[#E85B49] transition-colors leading-snug line-clamp-1">
                                {place.name}
                              </h4>
                              {placeActivities.length > 0 && (
                                <span className="text-[10px] font-semibold text-white bg-[#E85B49] px-1.5 py-0.2 rounded shrink-0 leading-tight">
                                  {placeActivities.map((a) => `Día ${a.dayNumber}`).join(', ')}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] mt-1">
                              {place.rating && (
                                <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                  <span>{place.rating}</span>
                                </span>
                              )}
                              <span>·</span>
                              <span className="capitalize">{place.subcategory || place.category}</span>
                            </div>
                          </div>

                          <div className="text-[11px] text-[#64748B] truncate mt-1">
                            {place.address.split(',')[0]}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Barra inferior de acciones con touch target cómodo */}
                    <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-[#F1F5F9] text-xs">
                      <span className="text-[10px] text-[#27856C] bg-[#27856C]/8 px-2 py-0.5 rounded-md font-medium">
                        {place.verification.verificationLevel === 'official_mincetur'
                          ? 'MINCETUR'
                          : 'Verificado'}
                      </span>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onToggleSavePlace(place.id)}
                          className="p-1.5 text-[#64748B] hover:text-[#17243A] hover:bg-[#F8FAFC] rounded-lg transition-colors cursor-pointer"
                          title={isSaved ? 'Quitar de guardados' : 'Guardar en Por visitar'}
                          aria-label={isSaved ? 'Quitar de guardados' : 'Guardar en Por visitar'}
                        >
                          <Bookmark
                            className={`w-4 h-4 ${
                              isSaved ? 'fill-[#D97706] text-[#D97706]' : ''
                            }`}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveDayPickerPlaceId(isDayPickerOpen ? null : place.id)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                            placeActivities.length > 0
                              ? 'text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
                              : 'text-[#17243A] hover:text-white hover:bg-[#17243A] bg-[#F8FAFC] border border-[#E2E8F0]'
                          }`}
                        >
                          <span>{placeActivities.length > 0 ? 'Días' : '+ Añadir'}</span>
                          <ChevronRight className="w-3 h-3 opacity-60" />
                        </button>
                      </div>
                    </div>

                    {/* Selector emergente de día asignable (con toggle independiente) */}
                    {isDayPickerOpen && (
                      <div
                        className="mt-2.5 pt-2.5 border-t border-[#E9EEF4] flex items-center justify-between text-xs gap-2 animate-in fade-in duration-100 min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[#64748B] text-[11px] font-medium shrink-0">Asignar a:</span>
                        <HorizontalScrollContainer
                          containerClassName="flex-1 min-w-0"
                          className="gap-1 py-0.5"
                          gradientTheme="white"
                          arrowSize="sm"
                          ariaLabel="Asignar actividad a día"
                        >
                          {dayItems.map((d) => {
                            const isAlreadyInDay = trip.activities.some(
                              (a) => a.placeId === place.id && a.dayNumber === d.dayNumber
                            );
                            return (
                              <button
                                key={d.dayNumber}
                                type="button"
                                onClick={() => handleToggleDay(place, d.dayNumber)}
                                className={`px-2.5 py-1 font-mono font-medium text-[11px] rounded-lg cursor-pointer transition-colors shrink-0 flex-shrink-0 whitespace-nowrap ${
                                  isAlreadyInDay
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                                    : 'bg-[#17243A] text-white hover:bg-[#E85B49] border border-[#17243A]'
                                }`}
                                title={isAlreadyInDay ? `Día ${d.dayNumber} asignado (Pulsar para desasignar)` : `Añadir a Día ${d.dayNumber}`}
                              >
                                {isAlreadyInDay ? `✓ D${d.dayNumber}` : `D${d.dayNumber}`}
                              </button>
                            );
                          })}
                        </HorizontalScrollContainer>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredPlaces.length === 0 && (
              <div className="text-center py-12 px-4 border border-dashed border-[#E9EEF4] rounded-xl text-xs text-[#64748B] bg-white flex flex-col items-center justify-center gap-2.5">
                <Compass className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                <div>
                  <p className="font-semibold text-slate-700 text-sm">No se encontraron lugares</p>
                  <p className="text-[#64748B] mt-0.5">
                    No hay resultados en {activeLocalityLabel} para los filtros seleccionados.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onCategoryChange?.('todas');
                    onLocalityChange?.('todas');
                    onSearchChange?.('');
                  }}
                  className="mt-1 px-3.5 py-1.5 bg-[#17243A] text-white text-xs font-semibold rounded-lg hover:bg-[#E85B49] transition-colors cursor-pointer"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // SECCIÓN 3: ITINERARIO POR DÍAS (PHASE 3)
  // ==========================================
  if (activeSection === 'itinerary') {
    return (
      <div
        ref={scrollContainerRef}
        className={`${containerWidthClass} h-full min-h-0 bg-white border-r border-[#E9EEF4] flex flex-col overflow-hidden select-none`}
      >
        <ItineraryView
          trip={trip}
          places={places}
          selectedPlace={selectedPlace}
          onSelectPlace={onSelectPlace}
          selectedDayNumber={selectedDayNumber}
          onSelectDayNumber={onSelectDayNumber}
          onRemoveActivity={onRemoveActivity}
          onMoveActivityToDay={onMoveActivityToDay}
          onMoveActivityPosition={onMoveActivityPosition}
          onReorderActivitiesForDay={onReorderActivitiesForDay}
          onReorderActivity={onReorderActivity}
          onAddManualActivity={onAddManualActivity}
          onNavigateToExplore={() => onSelectSection?.('explore')}
          isMapCollapsed={isMapCollapsed}
        />
      </div>
    );
  }

  // ==========================================
  // SECCIÓN 4: LUGARES PARA VISITAR (WISHLIST)
  // ==========================================
  if (activeSection === 'saved') {
    return (
      <div
        ref={scrollContainerRef}
        className={`${containerWidthClass} h-full min-h-0 bg-white border-r border-[#E9EEF4] flex flex-col p-4 overflow-y-auto select-none`}
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E9EEF4]">
          <div>
            <h2 className="text-sm font-bold font-display text-[#17243A]">
              Lugares para visitar
            </h2>
            <span className="text-xs text-[#64748B]">
              Lista de deseos sin día asignado (<strong className="text-[#D97706]">{savedPlaces.length}</strong> lugares)
            </span>
          </div>
        </div>

        {savedPlaces.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-[#E9EEF4] rounded-xl text-xs text-[#64748B]">
            No tienes lugares guardados todavía. Explora {trip.destinationName} y presiona el icono de marcador para guardarlos aquí.
          </div>
        ) : (
          <div className={`space-y-2 ${isMapCollapsed ? 'grid grid-cols-1 md:grid-cols-2 gap-3 space-y-0' : ''}`}>
            {savedPlaces.map((place) => (
              <div
                key={place.id}
                className="p-3 bg-white border border-[#E9EEF4] rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div
                  className="flex items-center gap-2.5 truncate cursor-pointer flex-1"
                  onClick={() => onSelectPlace(place)}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                    <PlaceImage
                      src={place.images[0]?.url}
                      alt={place.name}
                      category={place.category}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-[#17243A] truncate hover:text-[#E85B49]">
                      {place.name}
                    </div>
                    <div className="text-[11px] text-[#64748B] capitalize">{place.category}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-[#64748B]">Añadir:</span>
                    {dayItems.map((d) => {
                      const isAlreadyInDay = trip.activities.some(
                        (a) => a.placeId === place.id && a.dayNumber === d.dayNumber
                      );
                      return (
                        <button
                          key={d.dayNumber}
                          type="button"
                          onClick={() => handleToggleDay(place, d.dayNumber)}
                          className={`px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer transition-colors ${
                            isAlreadyInDay
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                              : 'bg-[#17243A] text-white hover:bg-[#E85B49] border border-[#17243A]'
                          }`}
                          title={isAlreadyInDay ? `Día ${d.dayNumber} asignado (Pulsar para desasignar)` : `Añadir a Día ${d.dayNumber}`}
                        >
                          {isAlreadyInDay ? `✓ D${d.dayNumber}` : `D${d.dayNumber}`}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleSavePlace(place.id)}
                    className="p-1 text-[#64748B] hover:text-rose-600 cursor-pointer"
                    title="Quitar de la lista"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // SECCIÓN 5: NOTAS
  // ==========================================
  return (
    <div
      ref={scrollContainerRef}
      className={`${containerWidthClass} h-full min-h-0 bg-white border-r border-[#E9EEF4] flex flex-col p-6 select-none`}
    >
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#E9EEF4]">
        <div>
          <h2 className="text-sm font-bold font-display text-[#17243A]">
            Notas y recordatorios
          </h2>
          <span className="text-xs text-[#64748B]">
            Apunta datos de reservas, contactos y consejos para tu estadía en {trip.destinationName}
          </span>
        </div>
        <span className="text-[10px] text-[#64748B] font-medium bg-[#F7F8FA] px-2 py-0.5 rounded border border-[#E9EEF4]">
          Autoguardado
        </span>
      </div>

      <textarea
        value={trip.notes || ''}
        onChange={(e) => onUpdateNotes(e.target.value)}
        placeholder={`Escribe consejos, contactos locales, números de reserva o detalles de transporte en ${trip.destinationName}...`}
        className="w-full flex-1 p-4 text-xs bg-[#F7F8FA] border border-[#E9EEF4] rounded-xl resize-none text-[#17243A] leading-relaxed focus:outline-none focus:border-[#17243A]"
      />
    </div>
  );
};
