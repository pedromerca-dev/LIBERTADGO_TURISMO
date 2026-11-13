import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Compass,
  X,
  ExternalLink,
  ChevronDown,
  Check,
  FileText,
  Tag,
  Star,
  AlertCircle
} from 'lucide-react';
import { Place, TripItinerary, TripActivity } from '../../types/catalog.ts';
import { generateDayList, TripDayItem } from '../../utils/dateUtils.ts';
import { getDayColor, getActivitiesForDay } from '../../utils/itineraryUtils.ts';
import { calculateRealRoute, RouteData } from '../../utils/routingService.ts';
import { PlaceImage } from '../common/PlaceImage.tsx';
import { HorizontalScrollContainer } from '../common/HorizontalScrollContainer.tsx';

interface ItineraryViewProps {
  trip: TripItinerary;
  places: Place[];
  selectedPlace: Place | null;
  onSelectPlace: (place: Place | null) => void;
  selectedDayNumber: number | null;
  onSelectDayNumber: (day: number | null) => void;
  onRemoveActivity: (activityId: string) => void;
  onMoveActivityToDay: (activityId: string, targetDayNumber: number) => void;
  onMoveActivityPosition?: (activityId: string, targetDayNumber: number, targetIndex: number) => void;
  onReorderActivitiesForDay?: (dayNumber: number, orderedActivityIds: string[]) => void;
  onReorderActivity: (activityId: string, direction: 'up' | 'down') => void;
  onAddManualActivity: (dayNumber: number, title: string, timeSlot?: string, notes?: string) => void;
  onNavigateToExplore: () => void;
  isMapCollapsed?: boolean;
}

export const ItineraryView: React.FC<ItineraryViewProps> = ({
  trip,
  places,
  selectedPlace,
  onSelectPlace,
  selectedDayNumber,
  onSelectDayNumber,
  onRemoveActivity,
  onMoveActivityToDay,
  onMoveActivityPosition,
  onReorderActivitiesForDay,
  onReorderActivity,
  onAddManualActivity,
  onNavigateToExplore,
  isMapCollapsed = false,
}) => {
  // Formulario de actividad manual
  const [manualFormDay, setManualFormDay] = useState<number | null>(null);
  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualTime, setManualTime] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Estados de Drag and Drop
  const [draggedActivityId, setDraggedActivityId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    activityId: string;
    dayNumber: number;
    position: 'before' | 'after';
  } | null>(null);
  const [dragOverDayNumber, setDragOverDayNumber] = useState<number | null>(null);

  // Referencias para el desplazamiento táctil horizontal de días
  const daysContainerRef = useRef<HTMLDivElement>(null);
  const dayButtonsRef = useRef<Map<number | 'all', HTMLButtonElement>>(new Map());
  const previousSelectedDayRef = useRef<number | null | undefined>(undefined);

  // Lista de días del viaje
  const dayItems: TripDayItem[] = useMemo(() => {
    return generateDayList(trip.startDate, trip.totalDays);
  }, [trip.startDate, trip.totalDays]);

  // Mapa de lugares para resolución rápida
  const placesMap = useMemo(() => {
    const map = new Map<string, Place>();
    places.forEach((p) => map.set(p.id, p));
    return map;
  }, [places]);

  // Desplazamiento horizontal controlado de pestañas de días
  useEffect(() => {
    // Al montar o cambiar de viaje, asegurar siempre que Día 1 y Todos los días aparezcan al inicio (scrollLeft = 0)
    if (previousSelectedDayRef.current === undefined) {
      previousSelectedDayRef.current = selectedDayNumber;
      if (daysContainerRef.current) {
        daysContainerRef.current.scrollTo({ left: 0, behavior: 'instant' });
      }
      return;
    }

    // Solo si el usuario cambió explícitamente de día, desplazar suavemente si queda fuera del viewport visible
    if (previousSelectedDayRef.current !== selectedDayNumber) {
      previousSelectedDayRef.current = selectedDayNumber;

      if (selectedDayNumber === null || selectedDayNumber === 1) {
        daysContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const targetKey = selectedDayNumber;
        const buttonEl = dayButtonsRef.current.get(targetKey);
        if (buttonEl && daysContainerRef.current) {
          buttonEl.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        }
      }
    }
  }, [selectedDayNumber]);

  // Días a mostrar según selección
  const daysToShow = useMemo(() => {
    if (selectedDayNumber) {
      return dayItems.filter((d) => d.dayNumber === selectedDayNumber);
    }
    return dayItems;
  }, [dayItems, selectedDayNumber]);

  // Recorridos viales reales calculados con OSRM por cada día
  const [dayRoutes, setDayRoutes] = useState<
    Record<number, { data: RouteData | null; isUnavailable: boolean; loading: boolean }>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function loadDayRoutes() {
      for (const day of dayItems) {
        const dayActs = getActivitiesForDay(trip.activities, day.dayNumber);
        const coords: [number, number][] = [];
        dayActs.forEach((act) => {
          const place = act.place || placesMap.get(act.placeId);
          if (place?.coordinates) {
            coords.push([place.coordinates.lng, place.coordinates.lat]);
          }
        });

        if (coords.length >= 2) {
          const res = await calculateRealRoute(coords);
          if (cancelled) return;
          setDayRoutes((prev) => ({
            ...prev,
            [day.dayNumber]: {
              data: res,
              isUnavailable: res === null,
              loading: false,
            },
          }));
        } else {
          setDayRoutes((prev) => ({
            ...prev,
            [day.dayNumber]: {
              data: null,
              isUnavailable: false,
              loading: false,
            },
          }));
        }
      }
    }

    loadDayRoutes();
    return () => {
      cancelled = true;
    };
  }, [trip.activities, dayItems, placesMap]);

  // Manejar creación de actividad manual
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

  // ==========================================
  // DRAG AND DROP HANDLERS (DESKTOP & POINTER)
  // ==========================================
  const handleDragStart = (e: React.DragEvent, act: TripActivity) => {
    e.dataTransfer.setData('text/plain', act.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedActivityId(act.id);
  };

  const handleDragOverCard = (
    e: React.DragEvent,
    targetAct: TripActivity,
    targetDayNumber: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (draggedActivityId === targetAct.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const position = offsetY < rect.height / 2 ? 'before' : 'after';

    setDragOverTarget({
      activityId: targetAct.id,
      dayNumber: targetDayNumber,
      position,
    });
    setDragOverDayNumber(targetDayNumber);
  };

  const handleDragOverEmptyDay = (e: React.DragEvent, dayNum: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDayNumber(dayNum);
    setDragOverTarget(null);
  };

  const handleDropOnCard = (
    e: React.DragEvent,
    targetAct: TripActivity,
    targetDayNumber: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const activityId = e.dataTransfer.getData('text/plain') || draggedActivityId;
    if (!activityId || activityId === targetAct.id) {
      setDraggedActivityId(null);
      setDragOverTarget(null);
      setDragOverDayNumber(null);
      return;
    }

    const dayActivities = getActivitiesForDay(trip.activities, targetDayNumber);
    const targetIdx = dayActivities.findIndex((a) => a.id === targetAct.id);

    if (targetIdx !== -1) {
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const isBefore = offsetY < rect.height / 2;
      const newIndex = isBefore ? targetIdx : targetIdx + 1;

      if (onMoveActivityPosition) {
        onMoveActivityPosition(activityId, targetDayNumber, newIndex);
      } else {
        onMoveActivityToDay(activityId, targetDayNumber);
      }
    }

    setDraggedActivityId(null);
    setDragOverTarget(null);
    setDragOverDayNumber(null);
  };

  const handleDropOnDayContainer = (e: React.DragEvent, dayNum: number) => {
    e.preventDefault();
    const activityId = e.dataTransfer.getData('text/plain') || draggedActivityId;
    if (activityId) {
      const dayActivities = getActivitiesForDay(trip.activities, dayNum);
      if (onMoveActivityPosition) {
        onMoveActivityPosition(activityId, dayNum, dayActivities.length);
      } else {
        onMoveActivityToDay(activityId, dayNum);
      }
    }
    setDraggedActivityId(null);
    setDragOverTarget(null);
    setDragOverDayNumber(null);
  };

  const handleDragEnd = () => {
    setDraggedActivityId(null);
    setDragOverTarget(null);
    setDragOverDayNumber(null);
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col bg-white overflow-hidden">
      {/* 
        ==================================================
        2. NAVEGACIÓN POR DÍAS (INSPIRACIÓN WANDERLOG)
        Barra horizontal completa y accesible con días de semana, fechas y contadores
        ==================================================
      */}
      <div className="border-b border-[#E9EEF4] bg-white px-3 sm:px-4 pt-3 pb-2.5 shrink-0 shadow-2xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#E85B49]" />
            <h2 className="text-xs sm:text-sm font-bold font-display text-[#17243A] tracking-tight">
              Organización del Itinerario
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[#64748B]">
            <strong className="text-[#17243A]">{trip.activities.length}</strong> act. en{' '}
            <strong className="text-[#17243A]">{trip.totalDays}</strong> días
          </span>
        </div>

        {/* Carousel horizontal de pestañas de días con soporte táctil fluido, degradados y flechas en desktop */}
        <HorizontalScrollContainer
          innerRef={daysContainerRef}
          containerClassName="w-full shrink-0"
          className="gap-1.5 py-0.5"
          gradientTheme="white"
          scrollStep={240}
          ariaLabel="Días del itinerario"
        >
          {/* Opción: Todos los días */}
          <button
            ref={(el) => {
              if (el) dayButtonsRef.current.set('all', el);
              else dayButtonsRef.current.delete('all');
            }}
            type="button"
            onClick={() => onSelectDayNumber(null)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 flex-shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
              selectedDayNumber === null
                ? 'bg-[#263B35] text-white border-[#263B35]'
                : 'bg-white text-[#263B35] hover:bg-[#F7F2E8] border-[#E9E7E1]'
            }`}
          >
            <span>Todos los días</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                selectedDayNumber === null ? 'bg-white/20 text-white' : 'bg-[#E9E7E1] text-[#263B35]'
              }`}
            >
              {trip.activities.length}
            </span>
          </button>

          {/* Días individuales */}
          {dayItems.map((day) => {
            const dayCount = trip.activities.filter((a) => a.dayNumber === day.dayNumber).length;
            const isSelected = selectedDayNumber === day.dayNumber;
            const dayColor = getDayColor(day.dayNumber);

            return (
              <button
                ref={(el) => {
                  if (el) dayButtonsRef.current.set(day.dayNumber, el);
                  else dayButtonsRef.current.delete(day.dayNumber);
                }}
                key={day.dayNumber}
                type="button"
                onClick={() => onSelectDayNumber(day.dayNumber)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 flex-shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#263B35] text-white border-[#263B35]'
                    : 'bg-white text-[#263B35] hover:bg-[#F7F2E8] border-[#E9E7E1]'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: dayColor.bg }}
                />
                <span>{day.label}</span>
                <span className="text-[10px] opacity-75">
                  ({day.weekdayShort})
                </span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded leading-none ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-[#E9E7E1] text-[#263B35]'
                  }`}
                >
                  {dayCount}
                </span>
              </button>
            );
          })}
        </HorizontalScrollContainer>
      </div>

      {/* 
        ==================================================
        CONTENIDO PRINCIPAL DEL ITINERARIO (POR DÍA O TODOS)
        ==================================================
      */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3.5">
        {daysToShow.map((day) => {
          const dayActs = getActivitiesForDay(trip.activities, day.dayNumber);
          const dayColor = getDayColor(day.dayNumber);
          const isDropTargetDay = dragOverDayNumber === day.dayNumber;
          const currentDayRoute = dayRoutes[day.dayNumber];

          return (
            <div
              key={day.dayNumber}
              onDragOver={(e) => handleDragOverEmptyDay(e, day.dayNumber)}
              onDrop={(e) => handleDropOnDayContainer(e, day.dayNumber)}
              className={`border rounded-lg overflow-hidden bg-white shadow-xs transition-all ${
                isDropTargetDay
                  ? 'border-[#E85B49] bg-rose-50/20'
                  : 'border-[#E9E7E1]'
              }`}
            >
              {/* Cabecera de la jornada */}
              <div className="flex items-center justify-between p-3 bg-[#F7F2E8] border-b border-[#E9E7E1]">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold text-white shrink-0"
                    style={{ backgroundColor: dayColor.bg }}
                  >
                    D{day.dayNumber}
                  </span>
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-[#263B35]">
                      {day.label} · {day.formattedDate}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-[11px] text-[#64748B]">
                        {dayActs.length === 0
                          ? 'Sin actividades programadas'
                          : `${dayActs.length} ${dayActs.length === 1 ? 'actividad' : 'actividades'}`}
                      </p>
                      {currentDayRoute?.data && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#263B35] bg-white px-2 py-0.5 rounded border border-[#E9E7E1]">
                          <span>🚗</span>
                          <span>{currentDayRoute.data.distanceFormatted}</span>
                          <span className="text-[#64748B]">·</span>
                          <span>~{currentDayRoute.data.durationFormatted}</span>
                        </span>
                      )}
                      {currentDayRoute?.isUnavailable && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
                          title="Recorrido vial aún no disponible para este tramo"
                        >
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span>Ruta vial no disponible</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setManualFormDay(manualFormDay === day.dayNumber ? null : day.dayNumber)
                    }
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-[#263B35] bg-white border border-[#E9E7E1] hover:bg-[#F7F2E8] rounded-md transition-colors cursor-pointer font-medium"
                    title="Añadir nota o actividad manual"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#E85B49]" />
                    <span>Actividad</span>
                  </button>

                  <button
                    type="button"
                    onClick={onNavigateToExplore}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-[#E85B49] hover:bg-[#D94C3A] rounded-md transition-colors cursor-pointer font-medium"
                    title="Explorar lugares para este día"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Explorar</span>
                  </button>
                </div>
              </div>

              {/* Formulario de Actividad Manual (Inline) */}
              {manualFormDay === day.dayNumber && (
                <form
                  onSubmit={(e) => handleCreateManual(e, day.dayNumber)}
                  className="p-3.5 bg-[#FAF7F2] border-b border-amber-200/80 space-y-2.5 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-950 uppercase tracking-wider">
                      Nueva Actividad en {day.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setManualFormDay(null)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Nombre de la actividad (ej. Almuerzo marino, Paseo en caballitos de totora)"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-[#17243A] focus:outline-none focus:ring-1 focus:ring-[#E85B49]"
                    autoFocus
                    required
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Hora (ej. 10:30 AM)"
                        value={manualTime}
                        onChange={(e) => setManualTime(e.target.value)}
                        className="w-full text-xs outline-none text-[#17243A]"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Notas breves o recordatorio"
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none text-[#17243A]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setManualFormDay(null)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#E85B49] hover:bg-[#CB4B39] rounded-lg cursor-pointer shadow-xs"
                    >
                      Guardar Actividad
                    </button>
                  </div>
                </form>
              )}

              {/* 
                ==================================================
                7. ESTADOS VACÍOS (FUNCIONAL Y ATRACTIVO)
                ==================================================
              */}
              {dayActs.length === 0 && manualFormDay !== day.dayNumber ? (
                <div className="p-8 text-center bg-white flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#64748B]">
                    <Compass className="w-6 h-6 stroke-[1.5] text-[#94A3B8]" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#17243A]">
                      Todavía no tienes actividades para este día
                    </h4>
                    <p className="text-[11px] sm:text-xs text-[#64748B] mt-1 max-w-sm mx-auto leading-relaxed">
                      Explora atractivos, restaurantes y playas de {trip.destinationName} para planificar tu jornada con orden correlativo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onNavigateToExplore}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#17243A] hover:bg-[#E85B49] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95 shadow-xs"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Explorar lugares</span>
                  </button>
                </div>
              ) : (
                /* 
                  ==================================================
                  3. TARJETAS DE ACTIVIDADES & 4. DRAG AND DROP
                  ==================================================
                */
                <div className="p-3 sm:p-4 space-y-2.5">
                  {dayActs.map((act, idx) => {
                    // Resolver el lugar asociado
                    const place = act.place || placesMap.get(act.placeId);
                    const isSelected = selectedPlace?.id === place?.id;
                    const isDraggingThis = draggedActivityId === act.id;
                    const isDropTargetBefore =
                      dragOverTarget?.activityId === act.id && dragOverTarget?.position === 'before';
                    const isDropTargetAfter =
                      dragOverTarget?.activityId === act.id && dragOverTarget?.position === 'after';

                    return (
                      <div
                        key={act.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, act)}
                        onDragOver={(e) => handleDragOverCard(e, act, day.dayNumber)}
                        onDrop={(e) => handleDropOnCard(e, act, day.dayNumber)}
                        onDragEnd={handleDragEnd}
                        className={`relative rounded-md border transition-all ${
                          isDraggingThis
                            ? 'opacity-40 scale-[0.98] border-dashed border-[#E85B49] bg-rose-50/40'
                            : isSelected
                            ? 'bg-[#F7F2E8] border-[#E85B49] shadow-2xs ring-1 ring-[#E85B49]'
                            : 'bg-white border-[#E9E7E1] hover:border-[#263B35]'
                        }`}
                      >
                        {/* Indicador visual de inserción Drop Target */}
                        {isDropTargetBefore && (
                          <div className="absolute -top-1 left-2 right-2 h-0.5 bg-[#E85B49] rounded-full z-20 pointer-events-none" />
                        )}
                        {isDropTargetAfter && (
                          <div className="absolute -bottom-1 left-2 right-2 h-0.5 bg-[#E85B49] rounded-full z-20 pointer-events-none" />
                        )}

                        <div className="p-3 flex items-start gap-3">
                          {/* Columna Izquierda: Handle de Drag & Drop + Número de Orden */}
                          <div className="flex flex-col items-center justify-center shrink-0 pt-0.5">
                            <span
                              className="w-5 h-5 rounded-full text-white text-[10px] font-medium flex items-center justify-center"
                              style={{ backgroundColor: dayColor.bg }}
                              title={`Orden de visita: #${act.order}`}
                            >
                              {act.order}
                            </span>
                            <div
                              className="mt-1 text-slate-300 hover:text-[#263B35] cursor-grab active:cursor-grabbing p-0.5 rounded touch-none"
                              title="Arrastrar para ordenar o mover de día"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>
                          </div>

                          {/* Fotografía de la actividad (PlaceImage) */}
                          <div
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-md overflow-hidden shrink-0 bg-slate-100 border border-[#E9E7E1] cursor-pointer"
                            onClick={() => {
                              if (place) onSelectPlace(place);
                            }}
                          >
                            <PlaceImage
                              src={place?.images[0]?.url}
                              alt={place?.name || act.customTitle || 'Actividad'}
                              category={place?.category || 'actividades'}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          {/* Información directa de la actividad */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              {/* Nombre */}
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (place) onSelectPlace(place);
                                  }}
                                  className="text-xs sm:text-sm font-semibold text-[#263B35] hover:text-[#E85B49] text-left leading-snug line-clamp-1 cursor-pointer"
                                >
                                  {act.customTitle || place?.name || 'Actividad'}
                                </button>

                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 bg-[#F7F2E8] text-[#263B35] border border-[#E9E7E1]">
                                  Día {act.dayNumber}
                                </span>
                              </div>

                              {/* Metadatos: Categoría, Calificación y Horario */}
                              <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] mt-0.5 flex-wrap">
                                {place?.category && (
                                  <span className="capitalize text-[#263B35]">
                                    {place.subcategory || place.category}
                                  </span>
                                )}
                                {place?.rating && (
                                  <>
                                    <span>·</span>
                                    <span className="flex items-center gap-0.5 text-[#263B35] font-medium">
                                      <Star className="w-3 h-3 fill-[#D9B66F] text-[#D9B66F]" />
                                      <span>{place.rating}</span>
                                    </span>
                                  </>
                                )}
                                <span>·</span>
                                <span className="flex items-center gap-1 text-[#64748B]">
                                  <Clock className="w-3 h-3 text-[#64748B]" />
                                  <span>{act.timeSlot || 'Horario flexible'}</span>
                                </span>
                              </div>

                              {/* Dirección concisa si existe */}
                              {place?.address && (
                                <div className="flex items-center gap-1 text-[11px] text-[#64748B] mt-0.5 truncate">
                                  <MapPin className="w-3 h-3 text-[#E85B49] shrink-0" />
                                  <span className="truncate">{place.address.split(',')[0]}</span>
                                </div>
                              )}

                              {/* Notas manuales añadidas */}
                              {act.notes && (
                                <div className="mt-1 p-1.5 bg-[#F7F2E8] rounded border border-[#E9E7E1] text-[11px] text-[#263B35] italic">
                                  «{act.notes}»
                                </div>
                              )}
                            </div>

                            {/* Barra inferior de acciones compacta */}
                            <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-[#E9E7E1] text-xs flex-wrap gap-2 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                {place && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectPlace(place)}
                                    className="text-[11px] font-medium text-[#263B35] hover:text-[#E85B49] flex items-center gap-1 cursor-pointer"
                                  >
                                    <MapPin className="w-3 h-3 text-[#E85B49]" />
                                    <span>Ver detalles</span>
                                  </button>
                                )}

                                {/* Selector de Mover a otro día */}
                                <div className="flex items-center gap-1 text-[11px] text-[#64748B]">
                                  <span className="hidden sm:inline">Mover:</span>
                                  <select
                                    value={act.dayNumber}
                                    onChange={(e) =>
                                      onMoveActivityToDay(act.id, Number(e.target.value))
                                    }
                                    aria-label="Mover a otro día"
                                    className="bg-white border border-[#E9E7E1] rounded px-1.5 py-0.5 text-[11px] text-[#263B35] outline-none font-medium cursor-pointer"
                                  >
                                    {dayItems.map((d) => (
                                      <option key={d.dayNumber} value={d.dayNumber}>
                                        {d.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Controles de Orden (Subir/Bajar) y Eliminar */}
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => onReorderActivity(act.id, 'up')}
                                  className="p-1 text-[#64748B] hover:text-[#263B35] hover:bg-[#F7F2E8] disabled:opacity-25 rounded cursor-pointer transition-colors"
                                  title="Subir orden de visita"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === dayActs.length - 1}
                                  onClick={() => onReorderActivity(act.id, 'down')}
                                  className="p-1 text-[#64748B] hover:text-[#263B35] hover:bg-[#F7F2E8] disabled:opacity-25 rounded cursor-pointer transition-colors"
                                  title="Bajar orden de visita"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRemoveActivity(act.id)}
                                  className="p-1 text-[#64748B] hover:text-[#E85B49] hover:bg-rose-50 rounded cursor-pointer transition-colors ml-0.5"
                                  title="Quitar actividad de este día"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
