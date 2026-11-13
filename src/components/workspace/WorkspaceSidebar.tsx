import React, { useRef, useEffect } from 'react';
import {
  Compass,
  Search,
  FileText,
  Bookmark,
  Calendar,
  Trophy
} from 'lucide-react';
import { TripItinerary } from '../../types/catalog.ts';
import { generateDayList } from '../../utils/dateUtils.ts';
import { HorizontalScrollContainer } from '../common/HorizontalScrollContainer.tsx';

export type WorkspaceSection =
  | 'overview'
  | 'explore'
  | 'ranking'
  | 'notes'
  | 'saved'
  | 'itinerary';

interface WorkspaceSidebarProps {
  trip: TripItinerary;
  activeSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  selectedDayNumber: number | null;
  onSelectDayNumber: (day: number | null) => void;
  totalPlacesCount?: number;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  trip,
  activeSection,
  onSelectSection,
  selectedDayNumber,
  onSelectDayNumber,
  totalPlacesCount,
}) => {
  const dayItems = generateDayList(trip.startDate, trip.totalDays);
  const savedCount = trip.savedPlaceIds?.length || 0;
  const totalActivities = trip.activities.length;

  const sectionNavRef = useRef<HTMLDivElement>(null);
  const sectionButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const mobileDaysNavRef = useRef<HTMLDivElement>(null);
  const mobileDayButtonsRef = useRef<Map<number | 'all', HTMLButtonElement>>(new Map());
  const previousSelectedDayRef = useRef<number | null | undefined>(undefined);

  // Scroll suave al botón de sección activo si queda fuera de vista en móvil
  useEffect(() => {
    const activeBtn = sectionButtonsRef.current.get(activeSection);
    if (activeBtn && sectionNavRef.current) {
      if (activeSection === 'itinerary' || activeSection === 'explore') {
        sectionNavRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeSection]);

  // Scroll suave al día seleccionado en móvil
  useEffect(() => {
    if (previousSelectedDayRef.current === undefined) {
      previousSelectedDayRef.current = selectedDayNumber;
      if (mobileDaysNavRef.current) {
        mobileDaysNavRef.current.scrollTo({ left: 0, behavior: 'instant' });
      }
      return;
    }

    if (previousSelectedDayRef.current !== selectedDayNumber) {
      previousSelectedDayRef.current = selectedDayNumber;
      if (selectedDayNumber === null || selectedDayNumber === 1) {
        mobileDaysNavRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const dayBtn = mobileDayButtonsRef.current.get(selectedDayNumber);
        if (dayBtn && mobileDaysNavRef.current) {
          dayBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      }
    }
  }, [selectedDayNumber]);

  return (
    <>
      {/* 
        VISTA MÓVIL (< md):
        Barra horizontal limpia de pestañas optimizada para smartphones
      */}
      <div className="flex md:hidden flex-col w-full bg-white border-b border-[#E9E7E1] shrink-0">
        {/* Pestañas de sección con scroll táctil fluido */}
        <HorizontalScrollContainer
          innerRef={sectionNavRef}
          containerClassName="w-full border-b border-[#E9E7E1]"
          className="px-3 py-1.5 gap-1.5"
          gradientTheme="white"
          ariaLabel="Secciones de navegación"
        >
          <button
            ref={(el) => {
              if (el) sectionButtonsRef.current.set('itinerary', el);
              else sectionButtonsRef.current.delete('itinerary');
            }}
            type="button"
            onClick={() => {
              onSelectSection('itinerary');
              onSelectDayNumber(null);
            }}
            className={`px-2.5 py-1 text-xs rounded-md shrink-0 flex-shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSection === 'itinerary'
                ? 'bg-[#263B35] text-white font-medium'
                : 'bg-white text-[#475569] hover:bg-slate-50 border border-[#E9E7E1]'
            }`}
          >
            <Calendar className={`w-3.5 h-3.5 ${activeSection === 'itinerary' ? 'text-[#E85B49]' : 'text-[#64748B]'}`} />
            <span>Itinerario</span>
            {totalActivities > 0 && (
              <span
                className={`text-[10px] tabular-nums font-mono px-1 rounded ${
                  activeSection === 'itinerary'
                    ? 'text-white/80'
                    : 'text-[#64748B]'
                }`}
              >
                {totalActivities}
              </span>
            )}
          </button>

          <button
            ref={(el) => {
              if (el) sectionButtonsRef.current.set('explore', el);
              else sectionButtonsRef.current.delete('explore');
            }}
            type="button"
            onClick={() => {
              onSelectSection('explore');
              onSelectDayNumber(null);
            }}
            className={`px-2.5 py-1 text-xs rounded-md shrink-0 flex-shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSection === 'explore'
                ? 'bg-[#263B35] text-white font-medium'
                : 'bg-white text-[#475569] hover:bg-slate-50 border border-[#E9E7E1]'
            }`}
          >
            <Search className={`w-3.5 h-3.5 ${activeSection === 'explore' ? 'text-[#E85B49]' : 'text-[#64748B]'}`} />
            <span>Explorar</span>
          </button>

          <button
            ref={(el) => {
              if (el) sectionButtonsRef.current.set('ranking', el);
              else sectionButtonsRef.current.delete('ranking');
            }}
            type="button"
            onClick={() => {
              onSelectSection('ranking');
              onSelectDayNumber(null);
            }}
            className={`px-2.5 py-1 text-xs rounded-md shrink-0 flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              activeSection === 'ranking'
                ? 'bg-[#263B35] text-white font-medium'
                : 'bg-white text-[#475569] border border-[#E9E7E1]'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 opacity-80" />
            <span>Ranking</span>
          </button>

          <button
            ref={(el) => {
              if (el) sectionButtonsRef.current.set('saved', el);
              else sectionButtonsRef.current.delete('saved');
            }}
            type="button"
            onClick={() => {
              onSelectSection('saved');
              onSelectDayNumber(null);
            }}
            className={`px-2.5 py-1 text-xs rounded-md shrink-0 flex-shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSection === 'saved'
                ? 'bg-[#263B35] text-white font-medium'
                : 'bg-white text-[#475569] hover:bg-slate-50 border border-[#E9E7E1]'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${activeSection === 'saved' ? 'text-[#E85B49] fill-[#E85B49]' : 'text-[#64748B]'}`} />
            <span>Por visitar</span>
            {savedCount > 0 && (
              <span
                className={`text-[10px] tabular-nums font-mono px-1 rounded ${
                  activeSection === 'saved'
                    ? 'text-white/80'
                    : 'text-[#64748B]'
                }`}
              >
                {savedCount}
              </span>
            )}
          </button>

          <button
            ref={(el) => {
              if (el) sectionButtonsRef.current.set('notes', el);
              else sectionButtonsRef.current.delete('notes');
            }}
            type="button"
            onClick={() => {
              onSelectSection('notes');
              onSelectDayNumber(null);
            }}
            className={`px-2.5 py-1 text-xs rounded-md shrink-0 flex-shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSection === 'notes'
                ? 'bg-[#263B35] text-white font-medium'
                : 'bg-white text-[#475569] hover:bg-slate-50 border border-[#E9E7E1]'
            }`}
          >
            <FileText className={`w-3.5 h-3.5 ${activeSection === 'notes' ? 'text-[#E85B49]' : 'text-[#64748B]'}`} />
            <span>Notas</span>
          </button>

          <button
            ref={(el) => {
              if (el) sectionButtonsRef.current.set('overview', el);
              else sectionButtonsRef.current.delete('overview');
            }}
            type="button"
            onClick={() => {
              onSelectSection('overview');
              onSelectDayNumber(null);
            }}
            className={`px-2.5 py-1 text-xs rounded-md shrink-0 flex-shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSection === 'overview'
                ? 'bg-[#263B35] text-white font-medium'
                : 'bg-white text-[#475569] hover:bg-slate-50 border border-[#E9E7E1]'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${activeSection === 'overview' ? 'text-[#E85B49]' : 'text-[#64748B]'}`} />
            <span>Resumen</span>
          </button>
        </HorizontalScrollContainer>

        {/* Sub-selector de días si está en itinerario */}
        {activeSection === 'itinerary' && (
          <HorizontalScrollContainer
            innerRef={mobileDaysNavRef}
            containerClassName="w-full bg-slate-50 border-b border-[#E9E7E1]"
            className="px-3 py-1.5 gap-1.5"
            gradientTheme="slate"
            ariaLabel="Días del itinerario móvil"
          >
            <button
              ref={(el) => {
                if (el) mobileDayButtonsRef.current.set('all', el);
                else mobileDayButtonsRef.current.delete('all');
              }}
              type="button"
              onClick={() => onSelectDayNumber(null)}
              className={`px-2 py-0.5 text-xs rounded-md font-mono shrink-0 flex-shrink-0 whitespace-nowrap cursor-pointer transition-colors ${
                selectedDayNumber === null
                  ? 'bg-[#263B35] text-white font-medium'
                  : 'bg-white text-[#64748B] hover:text-[#263B35] border border-[#E9E7E1]'
              }`}
            >
              Todos los días
            </button>
            {dayItems.map((d) => (
              <button
                ref={(el) => {
                  if (el) mobileDayButtonsRef.current.set(d.dayNumber, el);
                  else mobileDayButtonsRef.current.delete(d.dayNumber);
                }}
                key={d.dayNumber}
                type="button"
                onClick={() => onSelectDayNumber(d.dayNumber)}
                className={`px-2 py-0.5 text-xs rounded-md font-mono shrink-0 flex-shrink-0 whitespace-nowrap cursor-pointer transition-colors ${
                  selectedDayNumber === d.dayNumber
                    ? 'bg-[#263B35] text-white font-medium'
                    : 'bg-white text-[#64748B] hover:text-[#263B35] border border-[#E9E7E1]'
                }`}
              >
                Día {d.dayNumber}
              </button>
            ))}
          </HorizontalScrollContainer>
        )}
      </div>

      {/* 
        VISTA ESCRITORIO (≥ md):
        Barra lateral vertical fija SaaS
      */}
      <aside className="hidden md:flex w-52 h-full min-h-0 bg-white border-r border-[#E9E7E1] flex-col py-3 select-none shrink-0 overflow-y-auto">
        <div className="px-3 space-y-0.5">
          <button
            type="button"
            onClick={() => {
              onSelectSection('overview');
              onSelectDayNumber(null);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-left ${
              activeSection === 'overview'
                ? 'bg-[#263B35] text-white'
                : 'text-[#263B35] hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Compass className="w-4 h-4 opacity-80" />
              <span>Resumen</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectSection('explore');
              onSelectDayNumber(null);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-left ${
              activeSection === 'explore'
                ? 'bg-[#263B35] text-white'
                : 'text-[#263B35] hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 opacity-80" />
              <span>Explorar</span>
            </div>
            {totalPlacesCount !== undefined && totalPlacesCount > 0 && (
              <span
                className={`text-[10px] tabular-nums font-mono px-1.5 py-0.2 rounded ${
                  activeSection === 'explore'
                    ? 'text-white/80'
                    : 'text-[#64748B]'
                }`}
              >
                {totalPlacesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectSection('ranking');
              onSelectDayNumber(null);
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeSection === 'ranking'
                ? 'bg-[#263B35] text-white'
                : 'text-[#263B35] hover:bg-slate-50'
            }`}
          >
            <Trophy className="w-4 h-4 opacity-80" />
            <span>Ranking de videos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectSection('notes');
              onSelectDayNumber(null);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-left ${
              activeSection === 'notes'
                ? 'bg-[#263B35] text-white'
                : 'text-[#263B35] hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 opacity-80" />
              <span>Notas</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectSection('saved');
              onSelectDayNumber(null);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-left ${
              activeSection === 'saved'
                ? 'bg-[#263B35] text-white'
                : 'text-[#263B35] hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Bookmark className="w-4 h-4 opacity-80" />
              <span>Lugares para visitar</span>
            </div>
            {savedCount > 0 && (
              <span
                className={`text-[10px] tabular-nums font-mono px-1.5 py-0.2 rounded ${
                  activeSection === 'saved'
                    ? 'text-white/80'
                    : 'text-[#64748B]'
                }`}
              >
                {savedCount}
              </span>
            )}
          </button>
        </div>

        <div className="h-px bg-[#E9E7E1] my-2.5 mx-3" />

        <div className="px-3 flex-1">
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[11px] font-semibold text-[#64748B] tracking-tight">
              Itinerario por días
            </span>
            <span className="text-[10px] tabular-nums font-mono text-[#64748B]">
              {totalActivities} act.
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              onSelectSection('itinerary');
              onSelectDayNumber(null);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-left mb-1 ${
              activeSection === 'itinerary' && selectedDayNumber === null
                ? 'bg-[#263B35] text-white font-medium'
                : 'text-[#263B35] hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 opacity-80" />
              <span>Todos los días</span>
            </div>
          </button>

          <div className="space-y-0.5 ml-1 pl-2 border-l border-[#E9E7E1]">
            {dayItems.map((day) => {
              const dayCount = trip.activities.filter((a) => a.dayNumber === day.dayNumber).length;
              const isSelected = activeSection === 'itinerary' && selectedDayNumber === day.dayNumber;

              return (
                <button
                  key={day.dayNumber}
                  type="button"
                  onClick={() => {
                    onSelectSection('itinerary');
                    onSelectDayNumber(day.dayNumber);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#263B35] text-white font-medium'
                      : 'text-[#475569] hover:bg-slate-50 hover:text-[#263B35]'
                  }`}
                >
                  <div className="truncate">
                    <span className="font-medium">{day.label}</span>
                    <span className="text-[10px] opacity-70 ml-1.5">
                      {day.formattedDate.split(',')[0]}
                    </span>
                  </div>
                  {dayCount > 0 && (
                    <span
                      className={`text-[10px] tabular-nums font-mono px-1 py-0.2 rounded ${
                        isSelected
                          ? 'text-white/80'
                          : 'text-[#64748B]'
                      }`}
                    >
                      {dayCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
};
