import React, { useState, useMemo } from 'react';
import { Compass, MapPin, Calendar, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { LA_LIBERTAD_LOCALITIES, Locality } from '../types/geo.ts';
import { calculateTripDuration, formatDateRange } from '../utils/dateUtils.ts';
import { TripItinerary } from '../types/catalog.ts';
import { RiyMoLogo } from './common/RiyMoLogo.tsx';

interface TripCreationScreenProps {
  onTripCreated: (trip: TripItinerary) => void;
  savedTrips?: TripItinerary[];
  onSelectSavedTrip?: (trip: TripItinerary) => void;
}

export const TripCreationScreen: React.FC<TripCreationScreenProps> = ({
  onTripCreated,
  savedTrips = [],
  onSelectSavedTrip,
}) => {
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('trujillo');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fechas por defecto: próxima semana (5 días)
  const defaultDates = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() + 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 4);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }, []);

  const [startDate, setStartDate] = useState<string>(defaultDates.start);
  const [endDate, setEndDate] = useState<string>(defaultDates.end);
  const [tripName, setTripName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedLocality: Locality = useMemo(() => {
    return LA_LIBERTAD_LOCALITIES.find((l) => l.id === selectedDestinationId) || LA_LIBERTAD_LOCALITIES[0];
  }, [selectedDestinationId]);

  const filteredLocalities = useMemo(() => {
    if (!searchQuery.trim()) return LA_LIBERTAD_LOCALITIES;
    const q = searchQuery.toLowerCase().trim();
    return LA_LIBERTAD_LOCALITIES.filter((loc) =>
      loc.name.toLowerCase().includes(q) || loc.province.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const duration = useMemo(() => {
    return calculateTripDuration(startDate, endDate);
  }, [startDate, endDate]);

  const dateRangeFormatted = useMemo(() => {
    return formatDateRange(startDate, endDate);
  }, [startDate, endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!duration.isValid) {
      setErrorMsg(duration.error || 'Verifica las fechas seleccionadas.');
      return;
    }

    setIsSubmitting(true);
    const title = tripName.trim() || `Viaje a ${selectedLocality.name}`;

    const tripPayload = {
      destinationId: selectedLocality.id,
      startDate,
      endDate,
      title,
    };

    try {
      const response = await fetch('/api/itineraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripPayload),
      });

      const json = await response.json();
      if (response.ok && json.success && json.data) {
        onTripCreated(json.data);
      } else {
        createLocalTrip(title);
      }
    } catch {
      createLocalTrip(title);
    } finally {
      setIsSubmitting(false);
    }
  };

  const createLocalTrip = (title: string) => {
    const newTrip: TripItinerary = {
      id: `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title,
      destinationId: selectedLocality.id,
      destinationName: selectedLocality.name,
      startDate,
      endDate,
      totalDays: duration.days,
      totalNights: duration.nights,
      coverImage: selectedLocality.heroImage,
      notes: '',
      savedPlaceIds: [],
      activities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onTripCreated(newTrip);
  };

  return (
    <div className="h-full min-h-0 flex flex-col justify-between bg-[#F7F2E8]/40 overflow-y-auto lg:overflow-hidden py-3 sm:py-4 px-4 sm:px-6">
      <div className="max-w-xl mx-auto w-full my-auto">
        {/* Cabecera simplificada RIYMO */}
        <div className="text-center mb-3 sm:mb-4">
          <div className="inline-block mb-2">
            <RiyMoLogo variant="full" size="lg" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-[#263B35] tracking-tight">
            Planifica tu viaje
          </h1>
          <p className="text-xs text-[#64748B] mt-1 max-w-md mx-auto">
            Organiza itinerarios por días, descubre lugares en el mapa y explora los tesoros del norte peruano.
          </p>
        </div>

        {/* Tarjeta de creación compacta y adaptable */}
        <div className="bg-white rounded-2xl border border-[#E9EEF4] shadow-xs p-4 sm:p-5">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
            {errorMsg && (
              <div className="flex items-center gap-2 p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Destino */}
            <div>
              <label className="block text-[11px] font-semibold text-[#17243A] uppercase tracking-wider mb-1">
                Destino en La Libertad
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#F7F8FA] border border-[#E9EEF4] hover:border-slate-300 rounded-xl text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#E85B49] shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-[#17243A]">
                        {selectedLocality.name}
                      </span>
                      <span className="text-[11px] text-[#64748B] ml-1.5">
                        Prov. {selectedLocality.province}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[#64748B]">Cambiar</span>
                </button>

                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-[#E9EEF4] rounded-xl shadow-lg p-2 max-h-56 overflow-y-auto">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar localidad (Trujillo, Huanchaco, Moche...)"
                      className="w-full px-2.5 py-1.5 text-xs bg-[#F7F8FA] border border-[#E9EEF4] rounded-lg mb-1.5 focus:outline-none focus:border-[#17243A]"
                      autoFocus
                    />
                    <div className="space-y-0.5">
                      {filteredLocalities.map((loc) => (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => {
                            setSelectedDestinationId(loc.id);
                            setIsDropdownOpen(false);
                            setSearchQuery('');
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                            selectedDestinationId === loc.id
                              ? 'bg-[#17243A] text-white font-medium'
                              : 'hover:bg-[#F7F8FA] text-[#17243A]'
                          }`}
                        >
                          <span>{loc.name} · Prov. {loc.province}</span>
                          {selectedDestinationId === loc.id && <Check className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Accesos rápidos discretos */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {LA_LIBERTAD_LOCALITIES.slice(0, 4).map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setSelectedDestinationId(loc.id)}
                    className={`text-[11px] px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer ${
                      selectedDestinationId === loc.id
                        ? 'bg-[#17243A] text-white font-medium'
                        : 'bg-[#F7F8FA] text-[#64748B] hover:text-[#17243A] border border-[#E9EEF4]'
                    }`}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Fechas de viaje */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="start-date-input"
                  className="block text-[11px] font-semibold text-[#17243A] uppercase tracking-wider mb-1"
                >
                  Fecha de llegada
                </label>
                <input
                  id="start-date-input"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#F7F8FA] border border-[#E9EEF4] rounded-xl text-[#17243A] font-mono focus:outline-none focus:border-[#17243A]"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="end-date-input"
                  className="block text-[11px] font-semibold text-[#17243A] uppercase tracking-wider mb-1"
                >
                  Fecha de salida
                </label>
                <input
                  id="end-date-input"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#F7F8FA] border border-[#E9EEF4] rounded-xl text-[#17243A] font-mono focus:outline-none focus:border-[#17243A]"
                  required
                />
              </div>
            </div>

            {/* Resumen sutil reactivo de fechas */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#F7F8FA] rounded-xl border border-[#E9EEF4] text-xs">
              <div className="flex items-center gap-1.5 text-[#17243A]">
                <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                <span className="font-medium">{dateRangeFormatted}</span>
              </div>
              <span className="font-semibold text-[#17243A]">
                {duration.isValid ? `${duration.days} días · ${duration.nights} noches` : '—'}
              </span>
            </div>

            {/* Nombre del viaje (Opcional, autogenerado si se omite) */}
            <div>
              <label
                htmlFor="trip-name-input"
                className="block text-[11px] font-semibold text-[#17243A] uppercase tracking-wider mb-1"
              >
                Nombre del viaje <span className="text-[#64748B] font-normal lowercase">(opcional)</span>
              </label>
              <input
                id="trip-name-input"
                type="text"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder={`Viaje a ${selectedLocality.name}`}
                className="w-full px-3 py-1.5 text-xs bg-[#F7F8FA] border border-[#E9EEF4] rounded-xl text-[#17243A] placeholder:text-[#64748B]/60 focus:outline-none focus:border-[#17243A]"
              />
            </div>

            {/* Botón Principal (Coral solo aquí para llamada a la acción) */}
            <button
              type="submit"
              disabled={isSubmitting || !duration.isValid}
              className="w-full py-2.5 px-4 bg-[#E85B49] hover:bg-[#D94C3A] active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isSubmitting ? 'Creando espacio...' : 'Comenzar a planificar'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Sección compacta de viajes guardados (si existen) */}
        {savedTrips.length > 0 && onSelectSavedTrip && (
          <div className="mt-2.5 text-center">
            <span className="text-[11px] text-[#64748B] font-medium block mb-1">
              O continúa un viaje guardado:
            </span>
            <div className="flex flex-wrap justify-center gap-1.5">
              {savedTrips.slice(0, 3).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onSelectSavedTrip(st)}
                  className="px-2.5 py-1 text-xs bg-white hover:bg-[#E9EEF4]/60 border border-[#E9EEF4] rounded-lg text-[#17243A] font-medium transition-colors cursor-pointer"
                >
                  {st.title} ({st.destinationName})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-[11px] text-[#64748B] py-1 shrink-0">
        RIYMO · Exploración y Planificación Turística del Perú
      </div>
    </div>
  );
};
