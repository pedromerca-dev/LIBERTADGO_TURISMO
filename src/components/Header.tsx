import React, { useState } from 'react';
import {
  Compass,
  Plus,
  MapPin,
  Calendar,
  Layers,
  Share2,
  Check,
  Edit2,
  X,
  Map as MapIcon,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  Shield,
} from 'lucide-react';
import { TripItinerary } from '../types/catalog.ts';
import { formatDateRange } from '../utils/dateUtils.ts';
import { RiyMoLogo } from './common/RiyMoLogo.tsx';

interface HeaderProps {
  currentTrip: TripItinerary | null;
  activeView: 'workspace' | 'destinations';
  setActiveView: (view: 'workspace' | 'destinations') => void;
  onOpenCreateModal: () => void;
  onEditTrip?: () => void;
  onUpdateTripTitle?: (newTitle: string) => void;
  onOpenArchitectureModal: () => void;
  onOpenAdmin?: () => void;
  mobileTab?: 'content' | 'map';
  setMobileTab?: (tab: 'content' | 'map') => void;
  isMapCollapsed?: boolean;
  onToggleMapCollapse?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTrip,
  activeView,
  setActiveView,
  onOpenCreateModal,
  onEditTrip,
  onUpdateTripTitle,
  onOpenArchitectureModal,
  onOpenAdmin,
  mobileTab = 'content',
  setMobileTab,
  isMapCollapsed = false,
  onToggleMapCollapse,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(currentTrip?.title || '');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const formattedDates = currentTrip
    ? formatDateRange(currentTrip.startDate, currentTrip.endDate)
    : '';

  const handleSaveTitle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (titleInput.trim() && onUpdateTripTitle) {
      onUpdateTripTitle(titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const isInWorkspace = activeView === 'workspace' && currentTrip !== null;

  return (
    <>
      {/* ============================================================ */}
      {/* VISTA MÓVIL (< lg): ENCABEZADO DE 2 FILAS OPTIMIZADO         */}
      {/* ============================================================ */}
      {isInWorkspace && currentTrip ? (
        <header className="flex flex-col lg:hidden w-full bg-white border-b border-[#E9EEF4] shrink-0 select-none z-30 min-w-0">
          {/* Fila 1: Logo + Selector compacto de viaje + Botón Crear Viaje */}
          <div className="h-12 px-3 flex items-center justify-between gap-2 border-b border-[#F1F5F9] min-w-0">
            {/* Logo compacto RIYMO */}
            <button
              type="button"
              onClick={() => setActiveView('workspace')}
              className="flex items-center shrink-0 group cursor-pointer text-left focus:outline-none"
              title="RIYMO - Inicio"
            >
              <RiyMoLogo variant="compact" size="sm" showSubtitle={false} />
            </button>

            {/* Selector compacto y legible del viaje activo */}
            <div className="flex-1 min-w-0 mx-1 flex items-center justify-center">
              {isEditingTitle ? (
                <form onSubmit={handleSaveTitle} className="flex items-center gap-1 max-w-full">
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    className="px-2 py-0.5 text-xs font-bold text-[#17243A] border border-[#E85B49] rounded-md focus:outline-none w-28 sm:w-36"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="p-1 text-[#27856C] hover:bg-[#F7F8FA] rounded cursor-pointer"
                    title="Guardar"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTitleInput(currentTrip.title);
                      setIsEditingTitle(false);
                    }}
                    className="p-1 text-[#64748B] hover:bg-[#F7F8FA] rounded cursor-pointer"
                    title="Cancelar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTitleInput(currentTrip.title);
                    setIsEditingTitle(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors cursor-pointer text-left max-w-full"
                  title="Toca para renombrar este viaje"
                >
                  <MapPin className="w-3 h-3 text-[#E85B49] shrink-0" />
                  <span className="text-xs font-bold text-[#17243A] truncate max-w-[95px] xs:max-w-[140px] sm:max-w-[200px]">
                    {currentTrip.title}
                  </span>
                  <Edit2 className="w-2.5 h-2.5 text-[#94A3B8] shrink-0 ml-0.5 opacity-60" />
                </button>
              )}
            </div>

            {/* Acciones de cabecera: Compartir + Botón "+" para Crear Viaje */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleShare}
                className="w-8 h-8 flex items-center justify-center text-[#64748B] hover:text-[#17243A] hover:bg-[#F7F8FA] rounded-lg transition-colors cursor-pointer"
                title="Copiar enlace directo de este viaje"
                aria-label="Compartir viaje"
              >
                {copyFeedback ? (
                  <Check className="w-4 h-4 text-[#27856C]" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={onOpenCreateModal}
                className="w-8 h-8 rounded-lg bg-[#E85B49] text-white flex items-center justify-center hover:bg-[#D94C3A] active:scale-95 shadow-xs transition-transform cursor-pointer"
                title="Crear un nuevo viaje"
                aria-label="Nuevo viaje"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Fila 2: Selector segmentado Plan / Mapa */}
          {setMobileTab && (
            <div className="py-1.5 px-3 bg-white flex items-center justify-center min-w-0">
              <div className="w-full max-w-xs flex items-center p-0.5 bg-[#F1F5F9] rounded-xl border border-[#E2E8F0]/80">
                <button
                  type="button"
                  onClick={() => setMobileTab('content')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    mobileTab === 'content'
                      ? 'bg-white text-[#17243A] shadow-xs font-bold'
                      : 'text-[#64748B] hover:text-[#17243A]'
                  }`}
                >
                  <Compass
                    className={`w-3.5 h-3.5 ${
                      mobileTab === 'content' ? 'text-[#E85B49]' : 'text-[#64748B]'
                    }`}
                  />
                  <span>Plan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab('map')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    mobileTab === 'map'
                      ? 'bg-white text-[#17243A] shadow-xs font-bold'
                      : 'text-[#64748B] hover:text-[#17243A]'
                  }`}
                >
                  <MapIcon
                    className={`w-3.5 h-3.5 ${
                      mobileTab === 'map' ? 'text-[#E85B49]' : 'text-[#64748B]'
                    }`}
                  />
                  <span>Mapa</span>
                </button>
              </div>
            </div>
          )}
        </header>
      ) : null}

      {/* ============================================================ */}
      {/* VISTA ESCRITORIO (lg:) O VISTA SIN VIAJE ACTIVO              */}
      {/* ============================================================ */}
      <header
        className={`${
          isInWorkspace && currentTrip ? 'hidden lg:flex' : 'flex'
        } h-14 bg-white border-b border-[#E9E7E1] px-3 sm:px-4 lg:px-6 items-center justify-between shrink-0 select-none z-30 min-w-0`}
      >
        {/* ============================================================ */}
        {/* 1. ZONA IZQUIERDA: Logo + Contexto del Viaje Activo           */}
        {/* ============================================================ */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Logo RIYMO */}
          <button
            type="button"
            onClick={() => setActiveView('workspace')}
            className="flex items-center shrink-0 group cursor-pointer text-left focus:outline-none"
            title="RIYMO - Inicio"
          >
            <RiyMoLogo variant="full" size="md" />
          </button>

          {/* Datos contextuales del viaje activo (Desktop) */}
          {isInWorkspace && currentTrip && (
            <div className="flex items-center gap-1.5 sm:gap-2.5 pl-2 sm:pl-3 border-l border-[#E9E7E1] min-w-0">
              {/* Nombre editable del viaje */}
              <div className="min-w-0 truncate">
                {isEditingTitle ? (
                  <form onSubmit={handleSaveTitle} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      className="px-2 py-0.5 text-xs font-semibold text-[#263B35] border border-[#E85B49] rounded-md focus:outline-none max-w-[120px] sm:max-w-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="p-1 text-emerald-600 hover:bg-slate-100 rounded cursor-pointer"
                      title="Guardar"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTitleInput(currentTrip.title);
                        setIsEditingTitle(false);
                      }}
                      className="p-1 text-[#64748B] hover:bg-slate-100 rounded cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTitleInput(currentTrip.title);
                      setIsEditingTitle(true);
                    }}
                    className="flex items-center gap-1 text-left group truncate cursor-pointer hover:bg-slate-50 px-1.5 py-0.5 rounded-md transition-colors"
                    title="Clic para renombrar este viaje"
                  >
                    <h1 className="text-xs sm:text-sm font-semibold text-[#263B35] truncate max-w-[180px] md:max-w-xs">
                      {currentTrip.title}
                    </h1>
                    <Edit2 className="w-3 h-3 text-[#64748B] opacity-40 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:inline" />
                  </button>
                )}
              </div>

              {/* Destino y Fechas */}
              <div className="hidden md:flex items-center gap-1.5 text-xs text-[#64748B] shrink-0">
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={onEditTrip || onOpenCreateModal}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-50 text-[#263B35] font-medium transition-colors cursor-pointer"
                  title="Cambiar destino del viaje"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#E85B49] shrink-0" />
                  <span>{currentTrip.destinationName}</span>
                </button>

                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={onEditTrip || onOpenCreateModal}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-50 text-[#64748B] transition-colors cursor-pointer"
                  title="Editar fechas del viaje"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                  <span>{formattedDates}</span>
                  <span className="text-[11px] text-slate-500 ml-0.5 font-normal">
                    ({currentTrip.totalDays}d / {currentTrip.totalNights}n)
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* 2. ZONA CENTRAL: Enlaces corporativos si no hay viaje          */}
        {/* ============================================================ */}
        <div className="flex items-center gap-2">
          {!isInWorkspace && (
            <nav className="hidden lg:flex items-center gap-2 text-xs font-medium text-[#64748B]">
              <button
                type="button"
                onClick={() => setActiveView('workspace')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeView === 'workspace'
                    ? 'text-[#17243A] font-semibold bg-[#F7F8FA]'
                    : 'hover:text-[#17243A] hover:bg-[#F7F8FA]'
                }`}
              >
                Planificador
              </button>
              <button
                type="button"
                onClick={() => setActiveView('destinations')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeView === 'destinations'
                    ? 'text-[#17243A] font-semibold bg-[#F7F8FA]'
                    : 'hover:text-[#17243A] hover:bg-[#F7F8FA]'
                }`}
              >
                Destinos Liberteños
              </button>
              <button
                type="button"
                onClick={onOpenArchitectureModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[#64748B] hover:text-[#17243A] hover:bg-[#F7F8FA] rounded-lg transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Arquitectura MVP</span>
              </button>
            </nav>
          )}
        </div>

        {/* ============================================================ */}
        {/* 3. ZONA DERECHA: Control del Mapa + Compartir + Nuevo Viaje    */}
        {/* ============================================================ */}
        <div className="flex items-center gap-2 shrink-0">
          {isInWorkspace && onToggleMapCollapse && (
            <button
              type="button"
              onClick={onToggleMapCollapse}
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                isMapCollapsed
                  ? 'bg-[#E85B49]/10 text-[#E85B49] border-[#E85B49]/30 hover:bg-[#E85B49]/15'
                  : 'bg-white text-[#263B35] border-[#E9E7E1] hover:bg-slate-50'
              }`}
              title={isMapCollapsed ? 'Mostrar mapa' : 'Ocultar mapa'}
            >
              {isMapCollapsed ? (
                <>
                  <PanelRightOpen className="w-3.5 h-3.5 text-[#E85B49]" />
                  <span>Ver mapa</span>
                </>
              ) : (
                <>
                  <PanelRightClose className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>Ocultar mapa</span>
                </>
              )}
            </button>
          )}

          {/* Compartir viaje activo */}
          {isInWorkspace && (
            <button
              type="button"
              onClick={handleShare}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#263B35] bg-white hover:bg-slate-50 border border-[#E9E7E1] rounded-md transition-colors cursor-pointer"
              title="Copiar enlace de este viaje"
            >
              <Share2 className="w-3.5 h-3.5 text-[#64748B]" />
              <span>{copyFeedback ? 'Copiado' : 'Compartir'}</span>
            </button>
          )}

          {/* Botón Primario: Nuevo Viaje */}
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#E85B49] hover:bg-[#D94C3C] active:scale-[0.99] rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
            aria-label={currentTrip ? 'Crear un nuevo viaje' : 'Crear viaje'}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
            <span className="hidden sm:inline">{currentTrip ? 'Nuevo viaje' : 'Crear viaje'}</span>
            <span className="sm:hidden">{currentTrip ? 'Nuevo' : 'Crear'}</span>
          </button>
        </div>
      </header>
    </>
  );
};

