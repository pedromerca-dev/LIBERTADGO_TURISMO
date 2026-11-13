import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Star,
  Plus,
  MapPin,
  Phone,
  Clock,
  ShieldCheck,
  ChevronRight,
  X,
  Check,
  Trash2,
  ExternalLink,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { Place, PlaceCategory, TripItinerary } from '../../types/catalog.ts';
import { HorizontalScrollContainer } from '../common/HorizontalScrollContainer.tsx';
import { TikTokVideoGallery } from '../common/TikTokVideoGallery';

interface DiscoveryPanelProps {
  trip: TripItinerary;
  places: Place[];
  selectedPlace: Place | null;
  onSelectPlace: (place: Place | null) => void;
  onAddPlaceToDay: (place: Place, dayNumber: number) => void;
  onRemoveActivity?: (activityId: string) => void;
  initialCategory?: string;
}

const CATEGORIES: { id: PlaceCategory | 'todas'; label: string; icon: string }[] = [
  { id: 'todas', label: 'Todo', icon: '✨' },
  { id: 'restaurantes', label: 'Restaurantes', icon: '🍴' },
  { id: 'arqueologia', label: 'Arqueología', icon: '🏛️' },
  { id: 'playas', label: 'Playas', icon: '🌊' },
  { id: 'atractivos', label: 'Atractivos', icon: '⭐' },
  { id: 'hoteles', label: 'Hoteles', icon: '🏨' },
  { id: 'museos', label: 'Museos', icon: '🎨' },
];

export const DiscoveryPanel: React.FC<DiscoveryPanelProps> = ({
  trip,
  places,
  selectedPlace,
  onSelectPlace,
  onAddPlaceToDay,
  onRemoveActivity,
  initialCategory = 'todas',
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [targetDay, setTargetDay] = useState<number>(1);
  const [activeDaySelectorPlaceId, setActiveDaySelectorPlaceId] = useState<string | null>(null);

  // Filter places by locality, category, and text search
  const filteredPlaces = useMemo(() => {
    return places.filter((p) => {
      const matchesCategory = selectedCategory === 'todas' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));

      return matchesCategory && matchesQuery;
    });
  }, [places, selectedCategory, searchQuery]);

  // Check if a place is already added to the trip
  const getPlaceItineraryInfo = (placeId: string) => {
    return trip.activities.find((a) => a.placeId === placeId);
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-slate-200 overflow-hidden select-none">
      {/* Header with Title and Search */}
      <div className="p-3.5 border-b border-slate-200 space-y-2.5 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold font-display text-slate-900 tracking-tight">
              Descubrir experiencias
            </h3>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              ({filteredPlaces.length})
            </span>
          </div>

          <span className="text-[10px] text-[#E05A47] font-semibold bg-[#E05A47]/10 px-2 py-0.5 rounded">
            {trip.destinationName}
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Buscar en ${trip.destinationName} (ceviche, huacas, surf...)`}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#E05A47]"
          />
        </div>

        {/* Categories segmented scroll bar con soporte táctil, degradados y flechas en desktop */}
        <HorizontalScrollContainer
          containerClassName="w-full pb-1"
          className="gap-1"
          gradientTheme="white"
          ariaLabel="Categorías"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 flex items-center gap-1 ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <span className="text-[11px]">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </HorizontalScrollContainer>
      </div>

      {/* Place Detail Card (When a place is selected) */}
      {selectedPlace ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200">
            <button
              type="button"
              onClick={() => onSelectPlace(null)}
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 cursor-pointer"
            >
              ← Volver al catálogo
            </button>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              {selectedPlace.verification.verificationLevel === 'official_mincetur'
                ? 'MINCETUR Oficial'
                : 'Verificado'}
            </span>
          </div>

          {/* Place card container */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="relative h-48 overflow-hidden bg-slate-100">
              <img
                src={selectedPlace.images[0]?.url || ''}
                alt={selectedPlace.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[11px] px-2.5 py-0.5 rounded-lg font-mono">
                {selectedPlace.subcategory || selectedPlace.category}
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <h4 className="text-base font-bold font-display text-slate-900 leading-tight">
                  {selectedPlace.name}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  {selectedPlace.rating && (
                    <div className="flex items-center gap-1 text-amber-600 font-semibold">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{selectedPlace.rating}</span>
                      <span className="text-slate-400 font-normal">
                        ({selectedPlace.reviewsCount?.toLocaleString()} reseñas)
                      </span>
                    </div>
                  )}
                  <span>·</span>
                  <span className="capitalize">{selectedPlace.localityName}</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {selectedPlace.fullDescription || selectedPlace.shortDescription}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {selectedPlace.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Address, Phone, Hours */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{selectedPlace.address}</span>
                </div>
                {selectedPlace.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{selectedPlace.phone}</span>
                  </div>
                )}
                {selectedPlace.openingHours && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Abierto hoy: 07:00 – 23:00</span>
                  </div>
                )}
              </div>

              {/* Source traceability */}
              <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                <span>Fuente de datos: </span>
                <span className="font-semibold text-slate-600">
                  {selectedPlace.sources[0]?.sourceId.replace('_', ' ').toUpperCase()} ({selectedPlace.sources[0]?.externalId})
                </span>
              </div>

              {/* Action buttons */}
              <div className="pt-2 border-t border-slate-100">
                {(() => {
                  const activity = getPlaceItineraryInfo(selectedPlace.id);

                  if (activity) {
                    return (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>Agregado al Día {activity.dayNumber} (#{activity.order})</span>
                        </div>
                        {onRemoveActivity && (
                          <button
                            type="button"
                            onClick={() => onRemoveActivity(activity.id)}
                            className="text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="flex items-center gap-2">
                      <select
                        value={targetDay}
                        onChange={(e) => setTargetDay(Number(e.target.value))}
                        aria-label="Seleccionar día de asignación"
                        className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold outline-none"
                      >
                        {Array.from({ length: trip.totalDays }).map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            Día {i + 1}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => onAddPlaceToDay(selectedPlace, targetDay)}
                        className="flex-1 py-2 px-3 bg-[#E05A47] hover:bg-[#CB4B39] text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar al itinerario</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
             {/* Galería de videos turísticos del lugar seleccionado */}
             {selectedPlace.name === 'Hostal Paraíso' && (
            <div className="mt-4">
              <TikTokVideoGallery
                title="Videos de este lugar"
                description="Conoce este destino a través de sus creadores."
                showFilters={false}
                showSearch={false}videos={[
                  {
                    id: 'video-demo-1',
                    videoUrl:
                      'https://www.tiktok.com/@tiocuyitope/video/7621230431219830037',
                    title: 'Descubre este lugar en Trujillo',
                    creator: '@tiocuyitope',
                    placeName: selectedPlace.name,
                    category: 'Hospedaje',
                    views: 0,
                    likes: 0,
                    rating: 0,
                    updatedAt: new Date().toISOString(),
                  },
                ]}
              />
            </div>
          )}
        </div>
        
      ) : (
        /* Places Cards List */
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredPlaces.map((place) => {
            const activity = getPlaceItineraryInfo(place.id);
            const isDaySelectorOpen = activeDaySelectorPlaceId === place.id;

            return (
              <div
                key={place.id}
                onClick={() => onSelectPlace(place)}
                className={`bg-white rounded-xl border transition-all overflow-hidden cursor-pointer group ${
                  activity
                    ? 'border-emerald-200 bg-emerald-50/10'
                    : 'border-slate-200 hover:border-[#E05A47]/40 hover:shadow-xs'
                }`}
              >
                <div className="flex gap-3 p-3">
                  <img
                    src={place.images[0]?.url || ''}
                    alt={place.name}
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 rounded-lg object-cover shrink-0 bg-slate-100 group-hover:scale-105 transition-transform duration-300"
                  />

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#E05A47] transition-colors truncate">
                          {place.name}
                        </h4>
                        {activity && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded shrink-0">
                            Día {activity.dayNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                        {place.rating && (
                          <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            <span>{place.rating}</span>
                          </span>
                        )}
                        <span>·</span>
                        <span className="capitalize truncate text-slate-600">
                          {place.subcategory || place.category}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {place.shortDescription}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                      <span className="text-[10px] text-slate-400 truncate">
                        {place.address.split(',')[0]}
                      </span>

                      {activity ? (
                        <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-0.5">
                          <Check className="w-3 h-3" />
                          <span>Agregado</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDaySelectorPlaceId(isDaySelectorOpen ? null : place.id);
                          }}
                          className="text-xs font-bold text-[#E05A47] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Agregar</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Day selector popdown */}
                {isDaySelectorOpen && (
                  <div
                    className="px-3 pb-3 pt-1 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1.5 animate-in fade-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[11px] text-slate-600 font-medium shrink-0">Asignar a:</span>
                    <HorizontalScrollContainer
                      containerClassName="flex-1 min-w-0"
                      className="gap-1"
                      gradientTheme="slate"
                      arrowSize="sm"
                      ariaLabel="Asignar lugar a día"
                    >
                      {Array.from({ length: trip.totalDays }).map((_, i) => {
                        const dayNum = i + 1;
                        const inThisDay = trip.activities.some(
                          (a) => a.placeId === place.id && a.dayNumber === dayNum
                        );
                        return (
                          <button
                            key={dayNum}
                            type="button"
                            onClick={() => {
                              if (inThisDay) {
                                const act = trip.activities.find(
                                  (a) => a.placeId === place.id && a.dayNumber === dayNum
                                );
                                if (act && onRemoveActivity) onRemoveActivity(act.id);
                              } else {
                                onAddPlaceToDay(place, dayNum);
                              }
                            }}
                            className={`text-[10px] px-2 py-1 font-mono font-semibold rounded cursor-pointer transition-colors shrink-0 flex-shrink-0 whitespace-nowrap ${
                              inThisDay
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-white hover:bg-[#E05A47] hover:text-white border border-slate-200 text-slate-700'
                            }`}
                          >
                            {inThisDay ? `✓ D${dayNum}` : `D${dayNum}`}
                          </button>
                        );
                      })}
                    </HorizontalScrollContainer>
                  </div>
                )}
              </div>
            );
          })}

          {filteredPlaces.length === 0 && (
            <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl">
              <p className="text-xs text-slate-400">
                No se encontraron lugares en {trip.destinationName} para este filtro.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
