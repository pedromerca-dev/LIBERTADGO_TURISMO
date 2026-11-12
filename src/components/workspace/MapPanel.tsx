import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);
import { Place, TripItinerary } from '../../types/catalog.ts';
import { Locality } from '../../types/geo.ts';
import { getLocality } from '../../utils/geoBoundary.ts';
import { generateDayList, TripDayItem } from '../../utils/dateUtils.ts';
import {
  Search,
  SlidersHorizontal,
  Navigation,
  MapPin,
  Star,
  Bookmark,
  Plus,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  Check,
  Crosshair,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  ShieldCheck,
  Phone,
  Clock,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  Calendar,
  Compass
} from 'lucide-react';
import { PlaceImage } from '../common/PlaceImage.tsx';
import {
  FILTER_CATEGORIES,
  LOCALITY_FILTER_OPTIONS,
  matchesCategory,
  matchesSearchQuery,
  matchesLocality,
} from '../../utils/filterUtils.ts';
import { getDayColor } from '../../utils/itineraryUtils.ts';
import { calculateRealRoute, RouteData } from '../../utils/routingService.ts';
import { WorkspaceSection } from './WorkspaceSidebar.tsx';
import { HorizontalScrollContainer } from '../common/HorizontalScrollContainer.tsx';
import { PlaceVideosSection } from '../common/PlaceVideosSection.tsx';

interface MapPanelProps {
  trip: TripItinerary;
  places: Place[];
  selectedPlace: Place | null;
  onSelectPlace: (place: Place | null) => void;
  onAddPlaceToDay?: (place: Place, dayNumber: number) => void;
  onRemoveActivity?: (activityId: string) => void;
  onToggleSavePlace?: (placeId: string) => void;
  selectedDayNumber?: number | null;
  onSelectDayNumber?: (day: number | null) => void;
  activeSection?: WorkspaceSection;
  onSelectSection?: (section: WorkspaceSection) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileTab?: 'content' | 'map';
  onSwitchToContent?: () => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  selectedLocality?: string;
  onLocalityChange?: (locality: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// Categorías del catálogo con iconos y colores representativos
const CATEGORY_STYLES: Record<string, { bg: string; icon: string; label: string }> = {
  restaurantes: { bg: '#D97706', icon: '🍴', label: 'Gastronomía' },
  gastronomia: { bg: '#D97706', icon: '🍴', label: 'Gastronomía' },
  arqueologia: { bg: '#9A3412', icon: '🏛️', label: 'Arqueología' },
  playas: { bg: '#0284C7', icon: '🌊', label: 'Playas' },
  museos: { bg: '#7C3AED', icon: '🎨', label: 'Museos' },
  atractivos: { bg: '#059669', icon: '⭐', label: 'Atractivos' },
  hoteles: { bg: '#4338CA', icon: '🏨', label: 'Hoteles' },
};

export const MapPanel: React.FC<MapPanelProps> = ({
  trip,
  places,
  selectedPlace,
  onSelectPlace,
  onAddPlaceToDay,
  onRemoveActivity,
  onToggleSavePlace,
  selectedDayNumber = null,
  onSelectDayNumber,
  activeSection = 'explore',
  onSelectSection,
  isCollapsed = false,
  onToggleCollapse,
  mobileTab = 'content',
  onSwitchToContent,
  selectedCategory = 'todas',
  onCategoryChange,
  selectedLocality = 'todas',
  onLocalityChange,
  searchQuery = '',
  onSearchChange,
}) => {
  const isItineraryMode = activeSection === 'itinerary';
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const categoryChipButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const dayTabsScrollRef = useRef<HTMLDivElement>(null);
  const dayTabButtonsRef = useRef<Map<number | 'all', HTMLButtonElement>>(new Map());
  const previousSelectedDayRef = useRef<number | null | undefined>(undefined);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Scroll suave al filtro de categoría seleccionado en modo Explorar
  useEffect(() => {
    if (selectedCategory === 'todas') {
      categoryScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      const chip = categoryChipButtonsRef.current.get(selectedCategory);
      if (chip && categoryScrollRef.current) {
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [selectedCategory]);

  // Scroll suave al día seleccionado en el mapa (modo Planificar)
  useEffect(() => {
    if (previousSelectedDayRef.current === undefined) {
      previousSelectedDayRef.current = selectedDayNumber;
      if (dayTabsScrollRef.current) {
        dayTabsScrollRef.current.scrollTo({ left: 0, behavior: 'instant' });
      }
      return;
    }

    if (previousSelectedDayRef.current !== selectedDayNumber || isItineraryMode) {
      previousSelectedDayRef.current = selectedDayNumber;
      if (selectedDayNumber === null || selectedDayNumber === 1) {
        dayTabsScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const dayBtn = dayTabButtonsRef.current.get(selectedDayNumber);
        if (dayBtn && dayTabsScrollRef.current) {
          dayBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      }
    }
  }, [selectedDayNumber, isItineraryMode]);

  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [routeStatus, setRouteStatus] = useState<{
    isLoading: boolean;
    data: RouteData | null;
    dayNumber: number | null;
    isUnavailable: boolean;
    totalPoints: number;
  }>({
    isLoading: false,
    data: null,
    dayNumber: null,
    isUnavailable: false,
    totalPoints: 0,
  });

  // Estados de Búsqueda y Filtros tipo Google Maps
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState<boolean>(false);
  const [onlySavedFilter, setOnlySavedFilter] = useState<boolean>(false);
  const [minRatingFilter, setMinRatingFilter] = useState<number>(0);
  const [onlyMinceturFilter, setOnlyMinceturFilter] = useState<boolean>(false);

  // Filtro geográfico "Buscar en esta zona"
  const [showSearchAreaBtn, setShowSearchAreaBtn] = useState<boolean>(false);
  const [isAreaFilterActive, setIsAreaFilterActive] = useState<boolean>(false);
  const lastCenterRef = useRef<[number, number] | null>(null);

  // Geolocalización del usuario
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [userLocationMessage, setUserLocationMessage] = useState<string | null>(null);

  // Estado de Ficha Inferior (Bottom Sheet expandible)
  const [isCardExpanded, setIsCardExpanded] = useState<boolean>(false);
  const [quickDayPickerOpen, setQuickDayPickerOpen] = useState<boolean>(false);
  const [selectedDayToAssign, setSelectedDayToAssign] = useState<number>(1);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Cerrar selector al cambiar de lugar
  useEffect(() => {
    setQuickDayPickerOpen(false);
    setIsCardExpanded(false);
  }, [selectedPlace?.id]);

  const destinationLocality: Locality | undefined = getLocality(trip.destinationId);
  const centerLat = destinationLocality?.coordinates.lat || -8.1118;
  const centerLng = destinationLocality?.coordinates.lng || -79.0287;
  const initialZoom = destinationLocality?.defaultZoom || 14;

  const savedIds = useMemo(() => new Set(trip.savedPlaceIds || []), [trip.savedPlaceIds]);

  const dayItems: TripDayItem[] = useMemo(() => {
    return generateDayList(trip.startDate, trip.totalDays);
  }, [trip.startDate, trip.totalDays]);

  // Sincronizar el día predeterminado al abrir el selector
  useEffect(() => {
    if (quickDayPickerOpen && selectedPlace) {
      if (selectedDayNumber && selectedDayNumber >= 1 && selectedDayNumber <= trip.totalDays) {
        setSelectedDayToAssign(selectedDayNumber);
      } else {
        const firstAvailable = dayItems.find(
          (d) => !trip.activities.some((a) => a.placeId === selectedPlace.id && a.dayNumber === d.dayNumber)
        );
        setSelectedDayToAssign(firstAvailable ? firstAvailable.dayNumber : 1);
      }
    }
  }, [quickDayPickerOpen, selectedPlace, selectedDayNumber, trip.totalDays, dayItems, trip.activities]);

  // Lugares filtrados reactivamente (categoría, búsqueda, localidad y filtros avanzados)
  const filteredPlaces = useMemo(() => {
    return places.filter((p) => {
      // 0. Filtro no destructivo por localidad
      if (!matchesLocality(p.localityId, selectedLocality)) {
        return false;
      }

      // 1. Filtro por categoría principal unificado
      if (!matchesCategory(p.category, selectedCategory)) {
        return false;
      }

      // 2. Filtro de búsqueda por texto unificado (sin acentos, en todos los campos)
      if (!matchesSearchQuery(p, searchQuery)) {
        return false;
      }

      // 3. Filtros avanzados
      if (onlySavedFilter && !savedIds.has(p.id)) {
        return false;
      }

      if (minRatingFilter > 0 && (!p.rating || p.rating < minRatingFilter)) {
        return false;
      }

      if (onlyMinceturFilter && p.verification.verificationLevel !== 'official_mincetur') {
        return false;
      }

      // 4. Filtro por límites geográficos ("Buscar en esta zona")
      if (isAreaFilterActive && mapInstanceRef.current) {
        const bounds = mapInstanceRef.current.getBounds();
        if (!bounds.contains([p.coordinates.lng, p.coordinates.lat])) {
          return false;
        }
      }

      return true;
    });
  }, [
    places,
    selectedCategory,
    selectedLocality,
    searchQuery,
    onlySavedFilter,
    savedIds,
    minRatingFilter,
    onlyMinceturFilter,
    isAreaFilterActive,
  ]);

  // Recentrado suave del mapa cuando el usuario cambia de localidad
  const previousLocalityRef = useRef<string>(selectedLocality);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    if (previousLocalityRef.current !== selectedLocality) {
      previousLocalityRef.current = selectedLocality;

      if (selectedLocality && selectedLocality !== 'todas') {
        const targetLoc = getLocality(selectedLocality);
        if (targetLoc) {
          map.flyTo({
            center: [targetLoc.coordinates.lng, targetLoc.coordinates.lat],
            zoom: targetLoc.defaultZoom || 14.5,
            duration: 1200,
            essential: true,
          });
        }
      } else if (selectedLocality === 'todas') {
        // Enfoque regional La Libertad para abarcar costa y sierra
        map.flyTo({
          center: [-78.85, -7.95],
          zoom: 8.8,
          duration: 1200,
          essential: true,
        });
      }
    }
  }, [selectedLocality, mapLoaded]);

  // Sugerencias de búsqueda en tiempo real (Top 5)
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || !isSearchFocused) return [];
    return places
      .filter((p) => matchesSearchQuery(p, searchQuery))
      .slice(0, 5);
  }, [places, searchQuery, isSearchFocused]);

  // Inicializar MapLibre GL JS
  const initMap = useCallback(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    setMapError(null);
    setMapLoaded(false);

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: [
                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> | LibertadGO',
            },
          },
          layers: [
            {
              id: 'osm-tiles-layer',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: [centerLng, centerLat],
        zoom: initialZoom,
      });

      map.on('error', (e) => {
        if (e && e.error) {
          const err = e.error as { status?: number; message?: string };
          if (err.status === 403) {
            console.warn('[MapLibre] Tile access warning:', err.message);
          }
        }
      });

      // Detección de desplazamiento del mapa para "Buscar en esta zona"
      map.on('moveend', () => {
        const center = map.getCenter();
        if (lastCenterRef.current) {
          const [lastLng, lastLat] = lastCenterRef.current;
          const dist = Math.hypot(center.lng - lastLng, center.lat - lastLat);
          if (dist > 0.0035) {
            setShowSearchAreaBtn(true);
          }
        } else {
          lastCenterRef.current = [center.lng, center.lat];
        }
      });

      map.on('load', () => {
        if (!map.getSource('itinerary-route')) {
          map.addSource('itinerary-route', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          // Route casing (white line)
          map.addLayer({
            id: 'itinerary-route-casing',
            type: 'line',
            source: 'itinerary-route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#FFFFFF',
              'line-width': 6,
              'line-opacity': 0.95,
            },
          });

          // Route line (Coral #E85B49)
          map.addLayer({
            id: 'itinerary-route-line',
            type: 'line',
            source: 'itinerary-route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': ['coalesce', ['get', 'color'], '#E85B49'],
              'line-width': 3.5,
              'line-dasharray': [1, 0],
            },
          });
        }

        setMapLoaded(true);
      });

      mapInstanceRef.current = map;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al inicializar el mapa';
      console.error('[MapLibre] Error:', msg);
      setMapError(msg);
    }
  }, [centerLat, centerLng, initialZoom]);

  useEffect(() => {
    initMap();
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [initMap]);

  // ResizeObserver para redimensionar el canvas cuando cambia el tamaño del contenedor
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const ro = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.resize();
      }
    });

    ro.observe(mapContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Redimensionar el mapa cuando se activa la pestaña en móvil
  useEffect(() => {
    if (mobileTab === 'map' && mapInstanceRef.current) {
      requestAnimationFrame(() => {
        mapInstanceRef.current?.resize();
      });
      const timer = setTimeout(() => {
        mapInstanceRef.current?.resize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mobileTab]);

  // Redimensionar cuando cambia el estado de colapso en escritorio
  useEffect(() => {
    if (!isCollapsed && mapInstanceRef.current) {
      requestAnimationFrame(() => {
        mapInstanceRef.current?.resize();
      });
      const timer = setTimeout(() => {
        mapInstanceRef.current?.resize();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isCollapsed]);

  // Actualizar trazado de ruta del itinerario con cálculo real de carreteras (OSRM)
  // Regla estricta: Jamás trazar líneas rectas ficticias. Si la ruta real no está disponible, mostrar aviso.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource('itinerary-route') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    let isCancelled = false;

    async function updateItineraryRoutes() {
      if (!source) return;

      if (!isItineraryMode) {
        // En MODO EXPLORAR no se dibujan líneas de itinerario para mantener el mapa despejado
        source.setData({
          type: 'FeatureCollection',
          features: [],
        });
        setRouteStatus({
          isLoading: false,
          data: null,
          dayNumber: null,
          isUnavailable: false,
          totalPoints: 0,
        });
        return;
      }

      const features: {
        type: 'Feature';
        geometry: { type: 'LineString'; coordinates: [number, number][] };
        properties: { color?: string };
      }[] = [];

      if (selectedDayNumber) {
        // Modo Día individual: recorrido exclusivo de la jornada seleccionada
        const dayActivities = trip.activities
          .filter((a) => a.dayNumber === selectedDayNumber)
          .sort((a, b) => a.order - b.order);

        const routeCoordinates: [number, number][] = [];
        dayActivities.forEach((act) => {
          const place = act.place || places.find((p) => p.id === act.placeId);
          if (place?.coordinates) {
            routeCoordinates.push([place.coordinates.lng, place.coordinates.lat]);
          }
        });

        if (routeCoordinates.length >= 2) {
          setRouteStatus({
            isLoading: true,
            data: null,
            dayNumber: selectedDayNumber,
            isUnavailable: false,
            totalPoints: routeCoordinates.length,
          });

          const realRoute = await calculateRealRoute(routeCoordinates);
          if (isCancelled) return;

          if (realRoute && realRoute.coordinates.length >= 2) {
            features.push({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: realRoute.coordinates,
              },
              properties: {
                color: getDayColor(selectedDayNumber).bg,
              },
            });

            setRouteStatus({
              isLoading: false,
              data: realRoute,
              dayNumber: selectedDayNumber,
              isUnavailable: false,
              totalPoints: routeCoordinates.length,
            });
          } else {
            // No se pudo calcular el recorrido vial real: no inventar líneas rectas
            setRouteStatus({
              isLoading: false,
              data: null,
              dayNumber: selectedDayNumber,
              isUnavailable: true,
              totalPoints: routeCoordinates.length,
            });
          }
        } else {
          // Menos de 2 puntos en este día: no hay ruta
          setRouteStatus({
            isLoading: false,
            data: null,
            dayNumber: selectedDayNumber,
            isUnavailable: false,
            totalPoints: routeCoordinates.length,
          });
        }
      } else {
        // Modo Todos los días: trazar rutas viales independientes por jornada
        setRouteStatus({
          isLoading: true,
          data: null,
          dayNumber: null,
          isUnavailable: false,
          totalPoints: 0,
        });

        for (const day of dayItems) {
          const dayActivities = trip.activities
            .filter((a) => a.dayNumber === day.dayNumber)
            .sort((a, b) => a.order - b.order);

          const routeCoordinates: [number, number][] = [];
          dayActivities.forEach((act) => {
            const place = act.place || places.find((p) => p.id === act.placeId);
            if (place?.coordinates) {
              routeCoordinates.push([place.coordinates.lng, place.coordinates.lat]);
            }
          });

          if (routeCoordinates.length >= 2) {
            const realRoute = await calculateRealRoute(routeCoordinates);
            if (isCancelled) return;

            if (realRoute && realRoute.coordinates.length >= 2) {
              features.push({
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: realRoute.coordinates,
                },
                properties: {
                  color: getDayColor(day.dayNumber).bg,
                },
              });
            }
          }
        }

        if (isCancelled) return;

        setRouteStatus({
          isLoading: false,
          data: null,
          dayNumber: null,
          isUnavailable: false,
          totalPoints: features.length,
        });
      }

      if (features.length > 0 && showRoutes) {
        source.setData({
          type: 'FeatureCollection',
          features,
        });
      } else {
        source.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    }

    updateItineraryRoutes();

    return () => {
      isCancelled = true;
    };
  }, [trip.activities, places, mapLoaded, showRoutes, selectedDayNumber, dayItems, isItineraryMode]);

  // ==========================================
  // RENDERIZADO REACTIVO DE MARCADORES (FASE 3)
  // ==========================================
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Determinar qué lugares o actividades se deben renderizar según el Modo Contextual
    const isSingleDayMode = selectedDayNumber !== null;
    const renderedPlaceIds = new Set<string>();

    if (isItineraryMode) {
      // ============================================================
      // 1. MODO PLANIFICAR (ITINERARIO)
      // Mostrar ÚNICAMENTE los establecimientos asignados al día seleccionado
      // (o a todas las jornadas si es "Todos los días").
      // NO mostrar establecimientos del catálogo no programados para ese día.
      // ============================================================
      const relevantActivities = trip.activities
        .filter((a) => (isSingleDayMode ? a.dayNumber === selectedDayNumber : true))
        .sort((a, b) => {
          if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
          return a.order - b.order;
        });

      relevantActivities.forEach((act) => {
        const place = act.place || places.find((p) => p.id === act.placeId);
        if (!place) return;

        renderedPlaceIds.add(place.id);
        const isSelected = selectedPlace?.id === place.id;
        const dayColor = getDayColor(act.dayNumber);

        const el = document.createElement('div');
        el.className = 'libertadgo-map-marker-hitbox';
        el.style.width = '44px';
        el.style.height = '44px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.cursor = 'pointer';
        el.style.userSelect = 'none';
        el.style.pointerEvents = 'auto';
        el.style.zIndex = isSelected ? '20' : '10';
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', `${place.name} · Día ${act.dayNumber} · #${act.order}`);

        const inner = document.createElement('div');
        inner.className = 'libertadgo-map-marker-badge';
        inner.style.transition = 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1), filter 160ms ease';
        inner.style.display = 'flex';
        inner.style.alignItems = 'center';
        inner.style.justifyContent = 'center';
        inner.style.pointerEvents = 'none';

        const bg = isSelected ? '#17243A' : dayColor.bg;
        const badgeText = isSingleDayMode ? `${act.order}` : `D${act.dayNumber}·${act.order}`;

        inner.innerHTML = `
          <div style="
            background: ${bg};
            color: #FFFFFF;
            min-width: ${isSingleDayMode ? '32px' : '40px'};
            height: 32px;
            padding: 0 6px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: ${isSingleDayMode ? '13px' : '11px'};
            font-family: system-ui, -apple-system, sans-serif;
            border: 2.5px solid #FFFFFF;
            box-shadow: ${
              isSelected
                ? `0 0 0 4px rgba(232, 91, 73, 0.45), 0 6px 14px rgba(0, 0, 0, 0.35)`
                : `0 4px 10px rgba(0, 0, 0, 0.25)`
            };
            position: relative;
            transform: ${isSelected ? 'scale(1.15)' : 'none'};
          " title="${place.name} · Día ${act.dayNumber} (Visita #${act.order})">
            ${badgeText}
            <span style="
              position: absolute;
              bottom: -4px;
              left: 50%;
              margin-left: -4px;
              width: 8px;
              height: 8px;
              background: ${bg};
              transform: rotate(45deg);
              border-bottom: 2px solid #FFFFFF;
              border-right: 2px solid #FFFFFF;
            "></span>
          </div>
        `;

        el.appendChild(inner);

        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        el.addEventListener('mousedown', (e) => e.stopPropagation());
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectPlace(place);
          setIsCardExpanded(false);
        });

        el.addEventListener('mouseenter', () => {
          if (!isSelected) inner.style.transform = 'scale(1.18)';
        });
        el.addEventListener('mouseleave', () => {
          if (!isSelected) inner.style.transform = 'none';
        });

        const marker = new maplibregl.Marker({
          element: el,
          anchor: 'bottom',
        })
          .setLngLat([place.coordinates.lng, place.coordinates.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    } else {
      // ============================================================
      // 2. MODO EXPLORAR (CATÁLOGO COMPLETO)
      // Mostrar todos los lugares del catálogo que correspondan a los filtros activos
      // Mantener buscador y categorías, y permitir añadir al itinerario.
      // ============================================================
      filteredPlaces.forEach((place) => {
        renderedPlaceIds.add(place.id);
        const isSelected = selectedPlace?.id === place.id;
        const isSaved = savedIds.has(place.id);
        const categoryStyle = CATEGORY_STYLES[place.category] || {
          bg: '#17243A',
          icon: '📍',
          label: 'Lugar',
        };

        // Si ya está asignado en alguna jornada del viaje, mostrar indicador de día
        const inTrip = trip.activities.find((a) => a.placeId === place.id);

        const el = document.createElement('div');
        el.className = 'libertadgo-map-marker-hitbox';
        el.style.width = '44px';
        el.style.height = '44px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.cursor = 'pointer';
        el.style.userSelect = 'none';
        el.style.pointerEvents = 'auto';
        el.style.zIndex = isSelected ? '20' : '10';

        const inner = document.createElement('div');
        inner.className = 'libertadgo-map-marker-badge';
        inner.style.transition = 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1), filter 160ms ease';

        if (isSaved) {
          inner.innerHTML = `
            <div style="
              background: #17243A;
              color: #FBBF24;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 13px;
              border: 2px solid #D97706;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
              transform: ${isSelected ? 'scale(1.18)' : 'none'};
              position: relative;
            " title="${place.name} (Por visitar)">
              🔖
              ${inTrip ? `<span style="position: absolute; -top: 4px; -right: 6px; background: #E85B49; color: #FFF; font-size: 9px; font-weight: 800; border-radius: 8px; padding: 0 4px; border: 1.5px solid #FFF;">D${inTrip.dayNumber}</span>` : ''}
            </div>
          `;
        } else {
          inner.innerHTML = `
            <div style="
              background: ${isSelected ? '#17243A' : '#FFFFFF'};
              color: ${isSelected ? '#FFFFFF' : '#17243A'};
              width: 26px;
              height: 26px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              border: 2px solid ${categoryStyle.bg};
              box-shadow: ${isSelected ? '0 0 0 3px rgba(232, 91, 73, 0.4), 0 3px 8px rgba(0,0,0,0.25)' : '0 2px 6px rgba(0, 0, 0, 0.15)'};
              transform: ${isSelected ? 'scale(1.18)' : 'none'};
              position: relative;
            " title="${place.name} (${categoryStyle.label})">
              <span>${categoryStyle.icon}</span>
              ${inTrip ? `<span style="position: absolute; top: -5px; right: -7px; background: #E85B49; color: #FFF; font-size: 9px; font-weight: 800; border-radius: 8px; padding: 0 4px; border: 1.5px solid #FFF;">D${inTrip.dayNumber}</span>` : ''}
            </div>
          `;
        }

        el.appendChild(inner);

        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        el.addEventListener('mousedown', (e) => e.stopPropagation());
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectPlace(place);
          setIsCardExpanded(false);
        });

        el.addEventListener('mouseenter', () => {
          if (!isSelected) inner.style.transform = 'scale(1.18)';
        });
        el.addEventListener('mouseleave', () => {
          if (!isSelected) inner.style.transform = 'none';
        });

        const marker = new maplibregl.Marker({
          element: el,
          anchor: 'center',
        })
          .setLngLat([place.coordinates.lng, place.coordinates.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    }
  }, [
    filteredPlaces,
    selectedPlace,
    savedIds,
    trip.activities,
    selectedDayNumber,
    onSelectPlace,
    mapLoaded,
    searchQuery,
    selectedCategory,
    onlySavedFilter,
    places,
    isItineraryMode,
  ]);

  // Ajuste automático de encuadre en el mapa al cambiar de día
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    // Si hay un lugar seleccionado, el efecto de selectedPlace ya lo enfoca
    if (selectedPlace) return;

    if (selectedDayNumber) {
      const dayActivities = trip.activities.filter((a) => a.dayNumber === selectedDayNumber);
      const coords: [number, number][] = [];
      dayActivities.forEach((act) => {
        const place = act.place || places.find((p) => p.id === act.placeId);
        if (place?.coordinates) {
          coords.push([place.coordinates.lng, place.coordinates.lat]);
        }
      });

      if (coords.length === 1) {
        map.easeTo({
          center: coords[0],
          zoom: 15,
          duration: 500,
        });
      } else if (coords.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        coords.forEach((c) => bounds.extend(c));
        map.fitBounds(bounds, { padding: 70, maxZoom: 16, duration: 600 });
      }
    } else if (selectedDayNumber === null && trip.activities.length > 0) {
      const coords: [number, number][] = [];
      trip.activities.forEach((act) => {
        const place = act.place || places.find((p) => p.id === act.placeId);
        if (place?.coordinates) {
          coords.push([place.coordinates.lng, place.coordinates.lat]);
        }
      });
      if (coords.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        coords.forEach((c) => bounds.extend(c));
        map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 600 });
      }
    }
  }, [selectedDayNumber, trip.activities, places, mapLoaded, selectedPlace]);

  // Si hay un lugar seleccionado, asegurar que el mapa lo enfoque suavemente
  useEffect(() => {
    if (!selectedPlace || !mapInstanceRef.current || !mapLoaded) return;
    mapInstanceRef.current.easeTo({
      center: [selectedPlace.coordinates.lng, selectedPlace.coordinates.lat],
      zoom: Math.max(mapInstanceRef.current.getZoom(), 15),
      duration: 500,
    });
  }, [selectedPlace, mapLoaded]);

  // Geolocalización del usuario en tiempo real
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      setUserLocationMessage('Tu navegador no soporta geolocalización.');
      setTimeout(() => setUserLocationMessage(null), 3000);
      return;
    }

    setIsLocatingUser(true);
    setUserLocationMessage('Obteniendo ubicación...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocatingUser(false);
        const { latitude, longitude } = position.coords;

        const map = mapInstanceRef.current;
        if (map) {
          if (userMarkerRef.current) {
            userMarkerRef.current.remove();
          }

          const el = document.createElement('div');
          el.className = 'libertadgo-user-pulse-marker';
          el.innerHTML = `
            <div style="position: relative; width: 22px; height: 22px; pointer-events: none;">
              <div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(37, 99, 235, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position: absolute; inset: 0; border-radius: 50%; background: #2563EB; border: 2.5px solid #FFFFFF; box-shadow: 0 2px 8px rgba(0,0,0,0.35);"></div>
            </div>
          `;

          userMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([longitude, latitude])
            .addTo(map);

          map.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            duration: 800,
          });

          setUserLocationMessage('Ubicación localizada con éxito');
          setTimeout(() => setUserLocationMessage(null), 2500);
        }
      },
      (err) => {
        setIsLocatingUser(false);
        const msg =
          err.code === 1
            ? 'Permiso de ubicación denegado.'
            : 'No fue posible obtener tu ubicación.';
        setUserLocationMessage(msg);
        setTimeout(() => setUserLocationMessage(null), 3500);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Controles de zoom
  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn({ duration: 300 });
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut({ duration: 300 });
  };

  // Ajustar vista a todos los marcadores visibles
  const handleFitAllMarkers = () => {
    const map = mapInstanceRef.current;
    if (!map || filteredPlaces.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    filteredPlaces.forEach((p) => {
      bounds.extend([p.coordinates.lng, p.coordinates.lat]);
    });

    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 80, left: 60, right: 60 },
      maxZoom: 16,
      duration: 800,
    });
  };

  const handleResetCenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo({
      center: [centerLng, centerLat],
      zoom: initialZoom,
      duration: 600,
    });
    setIsAreaFilterActive(false);
    setShowSearchAreaBtn(false);
  };

  // Ejecutar búsqueda por límites del mapa ("Buscar en esta zona")
  const handleSearchInCurrentArea = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const center = map.getCenter();
    lastCenterRef.current = [center.lng, center.lat];
    setIsAreaFilterActive(true);
    setShowSearchAreaBtn(false);
  };

  // Añadir lugar a un día específico con feedback visual
  const handleAddPlaceWithFeedback = (place: Place, dayNumber: number) => {
    if (onAddPlaceToDay) {
      onAddPlaceToDay(place, dayNumber);
      setFeedbackNotice(`✓ Añadido al Día ${dayNumber}`);
      setTimeout(() => setFeedbackNotice(null), 2500);
    }
  };

  // Alternar (toggle) asignación de un lugar a un día específico con feedback visual
  const handleToggleDay = (place: Place, dayNumber: number) => {
    const existingActivity = trip.activities.find(
      (a) => a.placeId === place.id && a.dayNumber === dayNumber
    );

    if (existingActivity) {
      if (onRemoveActivity) {
        onRemoveActivity(existingActivity.id);
        setFeedbackNotice(`Eliminado del Día ${dayNumber}`);
        setTimeout(() => setFeedbackNotice(null), 2000);
      }
    } else {
      handleAddPlaceWithFeedback(place, dayNumber);
    }
  };

  const selectedPlaceActivities = useMemo(() => {
    if (!selectedPlace) return [];
    return trip.activities.filter((a) => a.placeId === selectedPlace.id);
  }, [selectedPlace, trip.activities]);

  const selectedPlaceActivity = selectedPlaceActivities[0] || null;

  const isSelectedSaved = useMemo(() => {
    if (!selectedPlace) return false;
    return savedIds.has(selectedPlace.id);
  }, [selectedPlace, savedIds]);

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden flex select-none">
      {/* Barra de Mapa Contraído (visible en Desktop cuando isCollapsed es true) */}
      {isCollapsed && (
        <div className="hidden lg:flex flex-col items-center justify-between py-4 px-2 w-12 bg-white border-l border-[#E9EEF4] h-full shrink-0 select-none">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2 hover:bg-[#F7F8FA] text-[#17243A] rounded-xl border border-[#E9EEF4] transition-colors cursor-pointer"
            title="Expandir mapa"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="[writing-mode:vertical-rl] text-xs font-semibold text-[#64748B] tracking-wider uppercase rotate-180">
            Mapa de {trip.destinationName}
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-[#E85B49]" />
        </div>
      )}

      {/* Contenedor Cartográfico Persistente */}
      <div
        className={`relative flex-1 h-full min-h-0 bg-[#E9EEF4]/30 overflow-hidden ${
          isCollapsed ? 'hidden' : 'flex flex-col'
        }`}
      >
        <div ref={mapContainerRef} className="w-full h-full relative" />

        {/* Error Banner si MapLibre no pudo renderizar */}
        {mapError && (
          <div className="absolute top-16 left-3 right-3 sm:right-auto sm:max-w-md z-30 bg-rose-50 border border-rose-200 rounded-xl p-3 shadow-md flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900 flex-1">
              <span className="font-bold block">Error al cargar cartografía:</span>
              <span>{mapError}</span>
            </div>
            <button
              type="button"
              onClick={initMap}
              className="p-1 text-rose-700 hover:bg-rose-100 rounded-lg cursor-pointer transition-colors"
              title="Reintentar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* BARRA SUPERIOR CONTEXTUAL: EXPLORAR VS PLANIFICAR            */}
        {/* ============================================================ */}
        <div className="absolute top-3 left-3 right-3 z-20 flex flex-col gap-2 max-w-lg pointer-events-none">
          {/* Selector de Modo Contextual: Explorar Catálogo vs Planificar Itinerario */}
          {onSelectSection && (
            <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-md border border-[#E2E8F0] pointer-events-auto self-start">
              <button
                type="button"
                onClick={() => onSelectSection('explore')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  !isItineraryMode
                    ? 'bg-[#17243A] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#17243A] hover:bg-[#F8FAFC]'
                }`}
              >
                <Compass className={`w-3.5 h-3.5 ${!isItineraryMode ? 'text-[#E85B49]' : 'text-[#64748B]'}`} />
                <span>Explorar</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectSection('itinerary')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isItineraryMode
                    ? 'bg-[#17243A] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#17243A] hover:bg-[#F8FAFC]'
                }`}
              >
                <Calendar className={`w-3.5 h-3.5 ${isItineraryMode ? 'text-[#E85B49]' : 'text-[#64748B]'}`} />
                <span>Planificar {trip.activities.length > 0 ? `(${trip.activities.length})` : ''}</span>
              </button>
            </div>
          )}

          {isItineraryMode ? (
            /* ================= MODO PLANIFICAR (ITINERARIO POR DÍAS) ================= */
            <div className="flex flex-col gap-1.5 pointer-events-auto animate-in fade-in duration-150">
              {/* Carrusel Desplazable de Días del Itinerario con soporte táctil fluido, degradados y flechas en desktop */}
              <HorizontalScrollContainer
                innerRef={dayTabsScrollRef}
                containerClassName="w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-[#E2E8F0] p-1 pointer-events-auto"
                className="gap-1.5"
                gradientTheme="white"
                scrollStep={220}
                ariaLabel="Días del itinerario en mapa"
              >
                {/* Opción: Todos los días */}
                <button
                  ref={(el) => {
                    if (el) dayTabButtonsRef.current.set('all', el);
                    else dayTabButtonsRef.current.delete('all');
                  }}
                  type="button"
                  onClick={() => onSelectDayNumber?.(null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex-shrink-0 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    selectedDayNumber === null
                      ? 'bg-[#17243A] text-white shadow-xs'
                      : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9] border border-[#E2E8F0]/70'
                  }`}
                >
                  <span>Todos los días</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      selectedDayNumber === null ? 'bg-white/20 text-white' : 'bg-[#E2E8F0] text-[#475569]'
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
                        if (el) dayTabButtonsRef.current.set(day.dayNumber, el);
                        else dayTabButtonsRef.current.delete(day.dayNumber);
                      }}
                      key={day.dayNumber}
                      type="button"
                      onClick={() => onSelectDayNumber?.(day.dayNumber)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex-shrink-0 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#17243A] text-white shadow-xs ring-2 ring-[#E85B49]/40'
                          : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9] border border-[#E2E8F0]/70'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: dayColor.bg }}
                      />
                      <span>{day.label}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full leading-none ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : dayCount > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-[#E2E8F0] text-[#64748B]'
                        }`}
                      >
                        {dayCount}
                      </span>
                    </button>
                  );
                })}
              </HorizontalScrollContainer>

              {/* Indicador de estado para el día seleccionado en Planificar */}
              {selectedDayNumber && (
                <div className="flex items-center gap-1.5 bg-[#17243A]/90 backdrop-blur-md text-white text-[11px] font-medium px-3 py-1.5 rounded-xl shadow-xs self-start">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: getDayColor(selectedDayNumber).bg }}
                  />
                  <span>
                    Día {selectedDayNumber}: {trip.activities.filter((a) => a.dayNumber === selectedDayNumber).length} actividades programadas
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* ================= MODO EXPLORAR (CATÁLOGO COMPLETO) ================= */
            <>
              {/* Barra de Búsqueda Flotante */}
              <div className="relative pointer-events-auto">
                <div className="flex items-center bg-white rounded-2xl shadow-md border border-[#E2E8F0] px-3.5 py-2.5 transition-all focus-within:ring-2 focus-within:ring-[#E85B49]/20 focus-within:border-[#E85B49]">
                  <Search className="w-4 h-4 text-[#64748B] shrink-0 mr-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    placeholder="Buscar restaurantes, playas, museos..."
                    className="w-full text-xs sm:text-sm text-[#17243A] placeholder:text-[#94A3B8] bg-transparent outline-none"
                  />

                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchChange?.('')}
                      className="p-1 text-[#94A3B8] hover:text-[#17243A] cursor-pointer"
                      title="Limpiar búsqueda"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="h-4 w-px bg-[#E2E8F0] mx-2" />

                  {/* Botón de Filtros Avanzados (Sliders) */}
                  <button
                    type="button"
                    onClick={() => setIsAdvancedFiltersOpen(true)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer relative ${
                      onlySavedFilter || minRatingFilter > 0 || onlyMinceturFilter
                        ? 'bg-[#E85B49] text-white'
                        : 'text-[#64748B] hover:text-[#17243A] hover:bg-[#F1F5F9]'
                    }`}
                    title="Filtros avanzados"
                    aria-label="Filtros avanzados"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    {(onlySavedFilter || minRatingFilter > 0 || onlyMinceturFilter) && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#17243A] border-2 border-white" />
                    )}
                  </button>
                </div>

                {/* Menú de Sugerencias en tiempo real */}
                {searchSuggestions.length > 0 && isSearchFocused && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-[#E2E8F0] overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-1.5 space-y-0.5">
                      {searchSuggestions.map((sug) => {
                        const style = CATEGORY_STYLES[sug.category];
                        const inTrip = trip.activities.find((a) => a.placeId === sug.id);
                        return (
                          <div
                            key={sug.id}
                            onMouseDown={() => {
                              onSelectPlace(sug);
                              onSearchChange?.(sug.name);
                              setIsSearchFocused(false);
                              mapInstanceRef.current?.flyTo({
                                center: [sug.coordinates.lng, sug.coordinates.lat],
                                zoom: 16,
                                duration: 700,
                              });
                            }}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <span className="text-sm shrink-0">{style?.icon || '📍'}</span>
                              <div className="truncate">
                                <span className="text-xs font-bold text-[#17243A] block truncate">
                                  {sug.name}
                                </span>
                                <span className="text-[11px] text-[#64748B] block truncate">
                                  {sug.address.split(',')[0]} · {sug.localityName}
                                </span>
                              </div>
                            </div>

                            {inTrip && (
                              <span className="text-[10px] font-semibold text-white bg-[#E85B49] px-1.5 py-0.5 rounded shrink-0 ml-2">
                                Día {inTrip.dayNumber}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Carrusel Desplazable de Filtros por Localidad en el mapa */}
              {onLocalityChange && (
                <HorizontalScrollContainer
                  containerClassName="w-full pointer-events-auto"
                  className="gap-1.5 py-0.5"
                  gradientTheme="white"
                  scrollStep={200}
                  ariaLabel="Filtros de localidad en mapa"
                >
                  {LOCALITY_FILTER_OPTIONS.map((loc) => {
                    const isLocActive = (selectedLocality || 'todas') === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => onLocalityChange?.(loc.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 flex-shrink-0 shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                          isLocActive
                            ? 'bg-[#E85B49] text-white ring-2 ring-[#E85B49]/30'
                            : 'bg-white/95 text-[#475569] hover:bg-white hover:text-[#0F172A] border border-[#E2E8F0]/80'
                        }`}
                        title={`Filtrar mapa por ${loc.name}`}
                      >
                        <MapPin className={`w-3 h-3 ${isLocActive ? 'text-white' : 'text-[#E85B49]'}`} />
                        <span>{loc.name}</span>
                      </button>
                    );
                  })}
                </HorizontalScrollContainer>
              )}

              {/* Carrusel Desplazable de Filtros por Categoría con soporte táctil fluido, degradados y flechas en desktop */}
              <HorizontalScrollContainer
                innerRef={categoryScrollRef}
                containerClassName="w-full pointer-events-auto"
                className="gap-1.5 py-0.5"
                gradientTheme="white"
                scrollStep={200}
                ariaLabel="Categorías de lugares en mapa"
              >
                {FILTER_CATEGORIES.map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      ref={(el) => {
                        if (el) categoryChipButtonsRef.current.set(cat.id, el);
                        else categoryChipButtonsRef.current.delete(cat.id);
                      }}
                      key={cat.id}
                      type="button"
                      onClick={() => onCategoryChange?.(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 flex-shrink-0 shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-[#17243A] text-white ring-2 ring-[#17243A]/20'
                          : 'bg-white/95 text-[#475569] hover:bg-white hover:text-[#0F172A] border border-[#E2E8F0]/80'
                      }`}
                    >
                      <span className="text-[11px]">{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </HorizontalScrollContainer>

              {/* Estado de Filtro de Zona Activo */}
              {isAreaFilterActive && (
                <div className="flex items-center gap-2 pointer-events-auto">
                  <span className="px-2.5 py-1 text-[11px] font-medium bg-[#17243A] text-white rounded-lg shadow-xs flex items-center gap-1.5">
                    <span>Filtro de zona activo ({filteredPlaces.length} lugares)</span>
                    <button
                      type="button"
                      onClick={() => setIsAreaFilterActive(false)}
                      className="p-0.5 hover:bg-white/20 rounded cursor-pointer"
                      title="Ver todos los lugares"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Botón Flotante "Buscar en esta zona" (Aparece cuando el usuario desplaza el mapa) */}
        {showSearchAreaBtn && !isAreaFilterActive && (
          <div className="absolute top-28 sm:top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-auto animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={handleSearchInCurrentArea}
              className="px-3.5 py-1.5 bg-white text-[#17243A] hover:bg-[#F8FAFC] active:scale-95 text-xs font-bold rounded-full shadow-md border border-[#E2E8F0] flex items-center gap-1.5 transition-transform cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#E85B49]" />
              <span>Buscar en esta zona</span>
            </button>
          </div>
        )}

        {/* Notificación flotante de ubicación del usuario */}
        {userLocationMessage && (
          <div className="absolute top-28 sm:top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-in fade-in duration-150">
            <div className="px-3 py-1.5 bg-[#17243A] text-white text-xs font-medium rounded-full shadow-md flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#E85B49]" />
              <span>{userLocationMessage}</span>
            </div>
          </div>
        )}

        {/* Indicador de recorrido del día (OSRM) */}
        {!userLocationMessage && routeStatus.isLoading && (
          <div className="absolute top-28 sm:top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-in fade-in duration-150">
            <div className="px-3.5 py-1.5 bg-[#17243A]/90 backdrop-blur-xs text-white text-xs font-medium rounded-full shadow-lg flex items-center gap-2 border border-slate-700">
              <RefreshCw className="w-3.5 h-3.5 text-[#E85B49] animate-spin" />
              <span>Calculando recorrido vial (Día {selectedDayNumber || ''})...</span>
            </div>
          </div>
        )}

        {!userLocationMessage && !routeStatus.isLoading && routeStatus.data && selectedDayNumber && (
          <div className="absolute top-28 sm:top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-auto animate-in fade-in duration-150 max-w-[92%] sm:max-w-md">
            <div className="px-3.5 py-1.5 bg-[#17243A] text-white text-xs font-medium rounded-full shadow-lg flex items-center gap-2 border border-slate-700">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: getDayColor(selectedDayNumber).bg }}
              />
              <span className="font-bold shrink-0">Día {selectedDayNumber}:</span>
              <span className="font-semibold text-emerald-400 shrink-0">
                {routeStatus.data.distanceFormatted}
              </span>
              <span className="text-slate-400">·</span>
              <span className="shrink-0">~{routeStatus.data.durationFormatted} en ruta</span>
              <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-300 font-mono hidden sm:inline">
                OSRM
              </span>
              <button
                type="button"
                onClick={() => setShowRoutes(!showRoutes)}
                className="ml-1 text-[11px] text-slate-300 hover:text-white underline cursor-pointer shrink-0"
                title={showRoutes ? 'Ocultar trazo en mapa' : 'Mostrar trazo en mapa'}
              >
                {showRoutes ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>
        )}

        {!userLocationMessage && !routeStatus.isLoading && routeStatus.isUnavailable && selectedDayNumber && (
          <div className="absolute top-28 sm:top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-auto animate-in fade-in duration-150 max-w-[92%] sm:max-w-md">
            <div className="px-3.5 py-1.5 bg-amber-950/90 backdrop-blur-xs text-amber-100 text-xs font-medium rounded-full shadow-lg flex items-center gap-2 border border-amber-600/40">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Recorrido vial aún no disponible para este tramo</span>
              <span className="text-[10px] text-amber-300 bg-amber-900/60 px-1.5 py-0.5 rounded shrink-0">
                Orden #1..#{routeStatus.totalPoints}
              </span>
            </div>
          </div>
        )}

        {/* Indicador de estado vacío en Modo Explorar */}
        {!isItineraryMode && filteredPlaces.length === 0 && mapLoaded && (
          <div className="absolute top-36 left-1/2 -translate-x-1/2 z-10 pointer-events-auto animate-in fade-in duration-200">
            <div className="bg-white/95 backdrop-blur-xs border border-[#E2E8F0] rounded-xl px-3.5 py-2 shadow-md text-xs text-[#64748B] flex items-center gap-2">
              <span>No hay lugares que coincidan con los filtros.</span>
              <button
                type="button"
                onClick={() => {
                  onCategoryChange?.('todas');
                  onSearchChange?.('');
                  setOnlySavedFilter(false);
                  setMinRatingFilter(0);
                  setOnlyMinceturFilter(false);
                  setIsAreaFilterActive(false);
                }}
                className="font-bold text-[#E85B49] hover:underline cursor-pointer"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        )}

        {/* Indicador de estado vacío en Modo Planificar */}
        {isItineraryMode && selectedDayNumber && trip.activities.filter((a) => a.dayNumber === selectedDayNumber).length === 0 && mapLoaded && (
          <div className="absolute top-36 left-1/2 -translate-x-1/2 z-10 pointer-events-auto animate-in fade-in duration-200 max-w-[92%] sm:max-w-sm">
            <div className="bg-white/95 backdrop-blur-md border border-[#E2E8F0] rounded-2xl p-4 shadow-lg text-center space-y-2">
              <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500 font-bold text-xs">
                D{selectedDayNumber}
              </span>
              <p className="text-xs font-bold text-[#17243A]">
                Sin actividades programadas para el Día {selectedDayNumber}
              </p>
              <p className="text-[11px] text-[#64748B]">
                Pasa al modo Explorar para descubrir experiencias y agregarlas a este día.
              </p>
              {onSelectSection && (
                <button
                  type="button"
                  onClick={() => onSelectSection('explore')}
                  className="px-3.5 py-1.5 bg-[#E85B49] text-white text-xs font-semibold rounded-xl hover:bg-[#D94C3A] transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Explorar experiencias</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* FICHA INFERIOR DE LUGARES (EXPANDIBLE / COMPACTA)            */}
        {/* ============================================================ */}
        {selectedPlace && (
          <div
            className={`absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md z-40 transition-all duration-300 ease-in-out ${
              isCardExpanded ? 'max-h-[80vh]' : 'max-h-56'
            }`}
          >
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden flex flex-col">
              {/* Barra de agarre para arrastrar o alternar estado expandido */}
              <div
                onClick={() => setIsCardExpanded(!isCardExpanded)}
                className="w-full py-1.5 flex items-center justify-center cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                title={isCardExpanded ? 'Contraer ficha' : 'Expandir ficha'}
              >
                <div className="w-9 h-1 rounded-full bg-slate-300" />
              </div>

              {/* Mensaje de confirmación visual */}
              {feedbackNotice && (
                <div className="bg-emerald-50 text-emerald-800 text-xs px-3 py-1.5 border-b border-emerald-100 flex items-center justify-between font-semibold animate-in fade-in duration-150">
                  <span>{feedbackNotice}</span>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              )}

              {/* MODO EXPANDIDO */}
              {isCardExpanded ? (
                <div className="p-4 space-y-3.5 overflow-y-auto max-h-[72vh]">
                  {/* Cabecera expandida */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-[#E85B49] uppercase tracking-wider block">
                        {selectedPlace.category} · {selectedPlace.localityName}
                      </span>
                      <h3 className="text-base font-bold font-display text-[#17243A] leading-snug">
                        {selectedPlace.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsCardExpanded(false)}
                        className="p-1 text-[#64748B] hover:text-[#17243A] rounded cursor-pointer"
                        title="Contraer"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectPlace(null)}
                        className="p-1 text-[#64748B] hover:text-[#17243A] rounded cursor-pointer"
                        title="Cerrar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Imagen completa */}
                  <div className="relative h-44 sm:h-52 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                    <PlaceImage
                      src={selectedPlace.images[0]?.url}
                      alt={selectedPlace.name}
                      category={selectedPlace.category}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Metadatos (Calificación y MINCETUR) */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {selectedPlace.rating && (
                        <div className="flex items-center gap-1 text-amber-600 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>{selectedPlace.rating}</span>
                          {selectedPlace.reviewsCount && (
                            <span className="text-[#64748B] font-normal">
                              ({selectedPlace.reviewsCount})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-[#27856C] bg-[#27856C]/10 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      {selectedPlace.verification.verificationLevel === 'official_mincetur'
                        ? 'MINCETUR Oficial'
                        : 'Verificado'}
                    </span>
                  </div>

                  {/* Descripción */}
                  <p className="text-xs text-[#475569] leading-relaxed">
                    {selectedPlace.fullDescription || selectedPlace.shortDescription}
                  </p>

                  {/* Dirección y Teléfono */}
                  <div className="pt-2 border-t border-[#E9EEF4] space-y-1.5 text-xs text-[#64748B]">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#E85B49] shrink-0" />
                      <span>{selectedPlace.address}</span>
                    </div>
                    {selectedPlace.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                        <span>{selectedPlace.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <PlaceVideosSection
                      placeId={selectedPlace.id}
                      placeName={selectedPlace.name}
                      compact={true}
                    />
                  </div>
                  {/* Asignación directa a días del viaje con toggle independiente */}
                  <div className="pt-3 border-t border-[#E9EEF4] space-y-2">
                    <span className="text-xs font-bold text-[#17243A] block">
                      Organizar en el Itinerario:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {dayItems.map((d) => {
                        const inThisDay = trip.activities.some(
                          (a) => a.placeId === selectedPlace.id && a.dayNumber === d.dayNumber
                        );
                        return (
                          <button
                            key={d.dayNumber}
                            type="button"
                            onClick={() => handleToggleDay(selectedPlace, d.dayNumber)}
                            className={`p-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                              inThisDay
                                ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                                : 'bg-[#F8FAFC] text-[#17243A] hover:bg-[#E85B49] hover:text-white border border-[#E2E8F0]'
                            }`}
                            title={inThisDay ? `Día ${d.dayNumber} asignado (Pulsar para desasignar)` : `Añadir a Día ${d.dayNumber}`}
                          >
                            <span>{inThisDay ? `✓ Día ${d.dayNumber}` : `Día ${d.dayNumber}`}</span>
                            <span className="text-[10px] font-normal opacity-80">{d.weekdayShort}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Botón para ver ficha completa en Plan */}
                  {onSwitchToContent && (
                    <button
                      type="button"
                      onClick={() => onSwitchToContent()}
                      className="w-full py-2 text-xs font-semibold text-[#17243A] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-xl transition-colors cursor-pointer text-center"
                    >
                      Abrir ficha completa en el Planificador →
                    </button>
                  )}
                </div>
              ) : (
                /* MODO COMPACTO (Default) */
                <div className="p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => setIsCardExpanded(true)}
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-100">
                        <PlaceImage
                          src={selectedPlace.images[0]?.url}
                          alt={selectedPlace.name}
                          category={selectedPlace.category}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] uppercase font-semibold">
                          <span>{selectedPlace.category}</span>
                          {selectedPlaceActivities.length > 0 && (
                            <span className="text-[#E85B49] font-bold">
                              · {selectedPlaceActivities.map((a) => `Día ${a.dayNumber}`).join(', ')}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold text-[#17243A] truncate mt-0.5 leading-snug">
                          {selectedPlace.name}
                        </h4>

                        <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                          {selectedPlace.address.split(',')[0]}
                        </p>

                        <div className="flex items-center gap-2 mt-1 text-[11px]">
                          {selectedPlace.rating && (
                            <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              <span>{selectedPlace.rating}</span>
                            </span>
                          )}
                          <span className="text-[10px] text-[#27856C] bg-[#27856C]/10 px-1.5 py-0.2 rounded font-medium">
                            {selectedPlace.verification.verificationLevel === 'official_mincetur'
                              ? 'MINCETUR'
                              : 'Verificado'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 -mt-1">
                      <button
                        type="button"
                        onClick={() => setIsCardExpanded(true)}
                        className="p-1 text-[#64748B] hover:text-[#17243A] cursor-pointer"
                        title="Ver detalles completos"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectPlace(null)}
                        className="p-1 text-[#64748B] hover:text-[#17243A] cursor-pointer"
                        title="Cerrar ficha"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Acciones directas sobre el lugar seleccionado */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9] text-xs">
                    {/* Botón Guardar en Wishlist */}
                    {onToggleSavePlace && (
                      <button
                        type="button"
                        onClick={() => onToggleSavePlace(selectedPlace.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                          isSelectedSaved
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#17243A]'
                        }`}
                        title={isSelectedSaved ? 'Quitar de guardados' : 'Guardar en Por visitar'}
                      >
                        <Bookmark
                          className={`w-3.5 h-3.5 ${
                            isSelectedSaved ? 'fill-[#D97706] text-[#D97706]' : ''
                          }`}
                        />
                        <span>{isSelectedSaved ? 'Guardado' : 'Guardar'}</span>
                      </button>
                    )}

                    {/* Botones de asignación de días con toggle independiente y scroll suave con flechas */}
                    <div className="flex-1 min-w-0 flex items-center gap-1.5 pl-2">
                      <span className="text-[11px] text-[#64748B] shrink-0 font-medium">Añadir a:</span>
                      <HorizontalScrollContainer
                        containerClassName="flex-1 min-w-0"
                        className="gap-1.5 py-0.5"
                        gradientTheme="white"
                        arrowSize="sm"
                        ariaLabel="Asignar lugar a día"
                      >
                        {dayItems.map((d) => {
                          const inThisDay = trip.activities.some(
                            (a) => a.placeId === selectedPlace.id && a.dayNumber === d.dayNumber
                          );
                          return (
                            <button
                              key={d.dayNumber}
                              type="button"
                              onClick={() => handleToggleDay(selectedPlace, d.dayNumber)}
                              className={`px-2.5 py-1.5 text-xs rounded-lg font-mono font-semibold shrink-0 flex-shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                                inThisDay
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                                  : 'bg-[#17243A] text-white hover:bg-[#E85B49] active:scale-95 shadow-2xs'
                              }`}
                              title={inThisDay ? `Día ${d.dayNumber} asignado (Pulsar para desasignar)` : `Añadir a Día ${d.dayNumber}`}
                            >
                              {inThisDay ? `✓ Día ${d.dayNumber}` : `Día ${d.dayNumber}`}
                            </button>
                          );
                        })}
                      </HorizontalScrollContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* HERRAMIENTAS FLOTANTES DE CONTROL (INFERIOR DERECHA)         */}
        {/* ============================================================ */}
        <div className="absolute bottom-4 right-3 z-20 flex flex-col gap-1.5">
          {/* Botón de Geolocalización Actual */}
          <button
            type="button"
            onClick={handleLocateUser}
            className={`p-2.5 bg-white hover:bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] shadow-md transition-all cursor-pointer ${
              isLocatingUser ? 'animate-pulse text-[#E85B49]' : 'text-[#17243A]'
            }`}
            title="Mi ubicación actual"
            aria-label="Mi ubicación actual"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          {/* Controles de Zoom */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-md overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2 text-[#17243A] hover:bg-[#F8FAFC] transition-colors cursor-pointer border-b border-[#F1F5F9]"
              title="Acercar mapa"
              aria-label="Acercar mapa"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2 text-[#17243A] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              title="Alejar mapa"
              aria-label="Alejar mapa"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>

          {/* Ajustar a todos los marcadores */}
          <button
            type="button"
            onClick={handleFitAllMarkers}
            className="p-2.5 bg-white hover:bg-[#F8FAFC] text-[#17243A] rounded-xl border border-[#E2E8F0] shadow-md transition-colors cursor-pointer"
            title="Ajustar vista a los lugares visibles"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Centrar en destino original */}
          <button
            type="button"
            onClick={handleResetCenter}
            className="p-2.5 bg-white hover:bg-[#F8FAFC] text-[#17243A] rounded-xl border border-[#E2E8F0] shadow-md transition-colors cursor-pointer"
            title={`Centrar en ${trip.destinationName}`}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL / BOTTOM SHEET DE FILTROS AVANZADOS (HEADER Y FOOTER FIJOS) */}
      {/* ============================================================ */}
      {isAdvancedFiltersOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs overscroll-none animate-in fade-in duration-150"
          onClick={() => setIsAdvancedFiltersOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-[#E2E8F0] shadow-2xl flex flex-col max-h-[85dvh] sm:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tirador táctil móvil */}
            <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto my-2 shrink-0 sm:hidden" />

            {/* Encabezado Fijo */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E9EEF4] shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#E85B49]" />
                <h3 className="text-sm font-bold font-display text-[#17243A]">
                  Filtros avanzados de mapa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvancedFiltersOpen(false)}
                className="p-1.5 text-[#64748B] hover:text-[#17243A] hover:bg-[#F1F5F9] rounded-lg cursor-pointer transition-colors"
                title="Cerrar filtros"
                aria-label="Cerrar filtros"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido Central con Scroll Táctil Independiente */}
            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4 touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {/* Categorías */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#17243A] block">Categoría:</span>
                <div className="flex flex-wrap gap-1.5">
                  {FILTER_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onCategoryChange?.(c.id)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
                        selectedCategory === c.id
                          ? 'bg-[#17243A] text-white font-semibold'
                          : 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0]'
                      }`}
                    >
                      {c.icon} {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Solo Guardados */}
              <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#17243A] block">
                    Solo lugares guardados
                  </span>
                  <span className="text-[11px] text-[#64748B]">
                    Muestra únicamente lugares en tu lista Por visitar
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={onlySavedFilter}
                  onChange={(e) => setOnlySavedFilter(e.target.checked)}
                  className="w-4 h-4 text-[#E85B49] rounded border-[#E2E8F0] cursor-pointer accent-[#E85B49]"
                />
              </div>

              {/* Calificación mínima */}
              <div className="pt-2 border-t border-[#F1F5F9] space-y-1.5">
                <span className="text-xs font-bold text-[#17243A] block">
                  Calificación mínima:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 0, label: 'Todas' },
                    { val: 4.0, label: '★ 4.0 o más' },
                    { val: 4.5, label: '★ 4.5 o más' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setMinRatingFilter(item.val)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        minRatingFilter === item.val
                          ? 'bg-[#17243A] text-white border-[#17243A]'
                          : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Certificación MINCETUR */}
              <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#17243A] block">
                    Solo certificados oficiales
                  </span>
                  <span className="text-[11px] text-[#64748B]">
                    Filtra por inventario oficial MINCETUR
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={onlyMinceturFilter}
                  onChange={(e) => setOnlyMinceturFilter(e.target.checked)}
                  className="w-4 h-4 text-[#E85B49] rounded border-[#E2E8F0] cursor-pointer accent-[#E85B49]"
                />
              </div>
            </div>

            {/* Pie Fijo con Botones de Acción */}
            <div className="p-4 border-t border-[#E9EEF4] bg-white shrink-0 flex items-center justify-between gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  onCategoryChange?.('todas');
                  onSearchChange?.('');
                  setOnlySavedFilter(false);
                  setMinRatingFilter(0);
                  setOnlyMinceturFilter(false);
                }}
                className="px-3.5 py-2.5 text-xs font-semibold text-[#64748B] hover:text-[#17243A] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer"
              >
                Limpiar filtros
              </button>

              <button
                type="button"
                onClick={() => setIsAdvancedFiltersOpen(false)}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#E85B49] hover:bg-[#D94C3A] rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Aplicar filtros ({filteredPlaces.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* BOTTOM SHEET SELECTOR DE DÍA (EXCLUSIVO MOBILE - md:hidden) */}
      {/* ============================================================ */}
      {quickDayPickerOpen && selectedPlace && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end md:hidden animate-in fade-in duration-200"
          onClick={() => setQuickDayPickerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-day-picker-title"
        >
          <div
            className="w-full bg-white rounded-t-3xl shadow-2xl border-t border-[#E2E8F0] flex flex-col max-h-[85dvh] overflow-hidden animate-in slide-in-from-bottom duration-250 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tirador táctil superior */}
            <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto my-2.5 shrink-0" />

            {/* Encabezado fijo */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-[#F1F5F9] shrink-0">
              <div className="min-w-0 pr-3">
                <h3 id="mobile-day-picker-title" className="text-base font-bold text-[#17243A] font-display">
                  Selecciona el día
                </h3>
                <p className="text-xs text-[#64748B] truncate mt-0.5">
                  {selectedPlace.name} · {selectedPlace.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickDayPickerOpen(false)}
                className="p-2 text-slate-400 hover:text-[#17243A] hover:bg-slate-100 rounded-full transition-colors cursor-pointer shrink-0"
                title="Cerrar selector"
                aria-label="Cerrar selector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista vertical desplazable con altura máxima contenida */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5 max-h-[50dvh] overscroll-contain pb-4">
              {dayItems.map((d) => {
                const isSelected = selectedDayToAssign === d.dayNumber;
                const isAlreadyIn = trip.activities.some(
                  (a) => a.placeId === selectedPlace.id && a.dayNumber === d.dayNumber
                );
                const dayActCount = trip.activities.filter(
                  (a) => a.dayNumber === d.dayNumber
                ).length;

                return (
                  <div
                    key={d.dayNumber}
                    onClick={() => {
                      setSelectedDayToAssign(d.dayNumber);
                      handleToggleDay(selectedPlace, d.dayNumber);
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isAlreadyIn
                        ? 'border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100/70 ring-1 ring-emerald-400/30'
                        : isSelected
                        ? 'border-[#E85B49] bg-[#E85B49]/5 ring-2 ring-[#E85B49]/20 shadow-xs'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Badge con número de día */}
                      <div
                        className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 transition-colors ${
                          isAlreadyIn
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : isSelected
                            ? 'bg-[#E85B49] text-white shadow-xs'
                            : 'bg-white border border-[#E2E8F0] text-[#17243A]'
                        }`}
                      >
                        <span className="text-[9px] uppercase tracking-wider leading-none">Día</span>
                        <span className="text-sm font-extrabold leading-tight">{d.dayNumber}</span>
                      </div>

                      {/* Detalles del día (Número, fecha y día de la semana) */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-[#17243A]">
                            {isAlreadyIn ? `✓ ${d.label}` : d.label}
                          </span>
                          <span className="text-xs text-[#64748B] font-medium capitalize">
                            · {d.weekdayShort}
                          </span>
                        </div>
                        <div className="text-xs text-[#64748B] flex items-center gap-1.5 mt-0.5">
                          <span>{d.formattedDate}</span>
                          {dayActCount > 0 && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span>{dayActCount} {dayActCount === 1 ? 'actividad' : 'actividades'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Indicador de selección táctil */}
                    <div className="shrink-0 pl-2">
                      {isAlreadyIn ? (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Asignado</span>
                        </span>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-slate-300" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pie fijo con botón de confirmación y cancelación */}
            <div className="p-4 border-t border-[#F1F5F9] bg-white flex flex-col gap-2 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {(() => {
                const isSelectedDayAlreadyIn = trip.activities.some(
                  (a) => a.placeId === selectedPlace.id && a.dayNumber === selectedDayToAssign
                );

                return (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handleToggleDay(selectedPlace, selectedDayToAssign);
                        setQuickDayPickerOpen(false);
                      }}
                      className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                        isSelectedDayAlreadyIn
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          : 'bg-[#E85B49] hover:bg-[#D94C3A] active:scale-[0.98] text-white'
                      }`}
                    >
                      {isSelectedDayAlreadyIn ? (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Quitar del Día {selectedDayToAssign}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                          <span>Añadir al Día {selectedDayToAssign}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setQuickDayPickerOpen(false)}
                      className="w-full py-2 text-xs font-semibold text-[#64748B] hover:text-[#17243A] text-center cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
