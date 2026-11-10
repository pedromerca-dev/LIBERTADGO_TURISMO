/**
 * LibertadGO - Intelligent Travel Planner (La Libertad, Perú)
 * Main Application Component: Coordinated SaaS Workspace inspired by Wanderlog.
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { TripCreationScreen } from './components/TripCreationScreen.tsx';
import { CreateTripModal } from './components/CreateTripModal.tsx';
import { ArchitectureModal } from './components/ArchitectureModal.tsx';
import { DestinationsGallery } from './components/DestinationsGallery.tsx';
import { WorkspaceSidebar, WorkspaceSection } from './components/workspace/WorkspaceSidebar.tsx';
import { WorkspaceContent } from './components/workspace/WorkspaceContent.tsx';
import { MapPanel } from './components/workspace/MapPanel.tsx';
import { INITIAL_PLACES } from './data/initialPlaces.ts';
import { TripItinerary, Place, TripActivity } from './types/catalog.ts';
import { matchesCategory, matchesSearchQuery, matchesLocality } from './utils/filterUtils.ts';
import {
  addPlaceToDay,
  removeActivityAndReindex,
  reorderDayActivities,
  moveActivityToDayAndIndex,
} from './utils/itineraryUtils.ts';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { AdminLayout } from './components/admin/AdminLayout.tsx';

const STORAGE_TRIPS_KEY = 'libertadgo_trips_v2';
const STORAGE_ACTIVE_ID_KEY = 'libertadgo_active_trip_id_v2';

function MainAppContent() {
  const { isAdmin, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<'public' | 'admin' | 'login'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) return 'admin';
      if (path.startsWith('/login')) return 'login';
    }
    return 'public';
  });

  const navigateTo = (route: 'public' | 'admin' | 'login') => {
    setCurrentRoute(route);
    if (typeof window !== 'undefined') {
      const path = route === 'admin' ? '/admin' : route === 'login' ? '/login' : '/';
      window.history.pushState(null, '', path);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) setCurrentRoute('admin');
      else if (path.startsWith('/login')) setCurrentRoute('login');
      else setCurrentRoute('public');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  // Navigation & view states
  const [activeView, setActiveView] = useState<'workspace' | 'destinations'>('workspace');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState<boolean>(false);
  const [modalTargetDestinationId, setModalTargetDestinationId] = useState<string>('trujillo');

  // Wanderlog Workspace State
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('overview');
  const [previousSection, setPreviousSection] = useState<WorkspaceSection | null>(null);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<'content' | 'map'>('content');
  const [isMapCollapsed, setIsMapCollapsed] = useState<boolean>(false);

  // Synchronized catalog & map filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [selectedLocality, setSelectedLocality] = useState<string>('todas');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Places catalog state (maintaining complete regional catalog of 297 places)
  const [places, setPlaces] = useState<Place[]>(INITIAL_PLACES);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  // Synchronized category change handler with detail view cleanup
  const handleCategoryChange = (newCat: string) => {
    setSelectedCategory(newCat);
    if (selectedPlace && !matchesCategory(selectedPlace.category, newCat)) {
      setSelectedPlace(null);
    }
  };

  // Synchronized locality change handler with detail view cleanup (non-destructive)
  const handleLocalityChange = (newLoc: string) => {
    setSelectedLocality(newLoc);
    if (
      selectedPlace &&
      newLoc !== 'todas' &&
      !matchesLocality(selectedPlace.localityId, newLoc)
    ) {
      setSelectedPlace(null);
    }
  };

  // Synchronized search query change handler with detail view cleanup
  const handleSearchChange = (newQuery: string) => {
    setSearchQuery(newQuery);
    if (selectedPlace && newQuery.trim() && !matchesSearchQuery(selectedPlace, newQuery)) {
      setSelectedPlace(null);
    }
  };

  // Centralized place selection handler to synchronize workspace section & map selection
  const handleSelectPlace = (place: Place | null) => {
    setSelectedPlace(place);

    // Only auto-switch to explore if we're not in itinerary or explore mode
    // In itinerary mode, keep user in itinerary mode and show place context
    if (place && activeSection !== 'itinerary' && activeSection !== 'explore') {
      setPreviousSection(activeSection);
      setActiveSection('explore');
    }
  };

  const handleReturnToPreviousSection = () => {
    setSelectedPlace(null);
    if (previousSection) {
      setActiveSection(previousSection);
      setPreviousSection(null);
    }
  };

  // Trips persistence state
  const [savedTrips, setSavedTrips] = useState<TripItinerary[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_TRIPS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Current active trip
  const [currentTrip, setCurrentTrip] = useState<TripItinerary | null>(() => {
    try {
      const activeId = localStorage.getItem(STORAGE_ACTIVE_ID_KEY);
      const stored = localStorage.getItem(STORAGE_TRIPS_KEY);
      if (activeId && stored) {
        const parsed: TripItinerary[] = JSON.parse(stored);
        const match = parsed.find((t) => t.id === activeId);
        if (match) return match;
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Persist trips to localStorage
  useEffect(() => {
    try {
      if (savedTrips.length > 0) {
        localStorage.setItem(STORAGE_TRIPS_KEY, JSON.stringify(savedTrips));
      }
      if (currentTrip) {
        localStorage.setItem(STORAGE_ACTIVE_ID_KEY, currentTrip.id);
      }
    } catch {
      // ignore
    }
  }, [savedTrips, currentTrip]);

  // Load full regional catalog (297 verified places across La Libertad)
  useEffect(() => {
    fetch('/api/places')
      .then((res) => res.json())
      .then((data) => {
        // Only update if backend successfully returns the full catalog (at least 297 places)
        if (data.success && Array.isArray(data.data) && data.data.length >= INITIAL_PLACES.length) {
          setPlaces(data.data);
        } else {
          setPlaces(INITIAL_PLACES);
        }
      })
      .catch(() => {
        setPlaces(INITIAL_PLACES);
      });
  }, []);

  // ==========================================
  // TRIP CREATION & SWITCHING HANDLERS
  // ==========================================
  const handleTripCreated = (newTrip: TripItinerary) => {
    setCurrentTrip(newTrip);
    setSavedTrips((prev) => {
      const filtered = prev.filter((t) => t.id !== newTrip.id);
      return [newTrip, ...filtered];
    });
    setActiveView('workspace');
    setActiveSection('overview');
    setPreviousSection(null);
    setSelectedPlace(null);
    setSelectedDayNumber(null);
    setSelectedCategory('todas');
    setSelectedLocality('todas');
    setSearchQuery('');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const handleSelectSavedTrip = (trip: TripItinerary) => {
    setCurrentTrip(trip);
    setActiveView('workspace');
    setActiveSection('overview');
    setPreviousSection(null);
    setSelectedPlace(null);
    setSelectedDayNumber(null);
    setSelectedCategory('todas');
    setSelectedLocality('todas');
    setSearchQuery('');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const handleUpdateTripTitle = (newTitle: string) => {
    if (!currentTrip) return;
    const updated = { ...currentTrip, title: newTitle, updatedAt: new Date().toISOString() };
    setCurrentTrip(updated);
    setSavedTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  // ==========================================
  // SYNCHRONIZED TRIP ACTIVITIES HANDLERS (PHASE 3)
  // ==========================================

  // 1. Add Place to Day (prevents duplicates in the same day)
  const handleAddPlaceToDay = (place: Place, dayNumber: number) => {
    if (!currentTrip) return;

    const result = addPlaceToDay(currentTrip.activities, currentTrip.id, place, dayNumber);
    if (!result.added) return;

    const updatedTrip: TripItinerary = {
      ...currentTrip,
      activities: result.activities,
      updatedAt: new Date().toISOString(),
    };

    setCurrentTrip(updatedTrip);
    setSavedTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
    setSelectedPlace(place);
  };

  // 2. Toggle Save Place to Wishlist (savedPlaceIds)
  const handleToggleSavePlace = (placeId: string) => {
    if (!currentTrip) return;

    const existing = new Set(currentTrip.savedPlaceIds || []);
    if (existing.has(placeId)) {
      existing.delete(placeId);
    } else {
      existing.add(placeId);
    }

    const updatedTrip: TripItinerary = {
      ...currentTrip,
      savedPlaceIds: Array.from(existing),
      updatedAt: new Date().toISOString(),
    };

    setCurrentTrip(updatedTrip);
    setSavedTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
  };

  // 3. Remove Activity from Trip (preserves catalog & other days)
  const handleRemoveActivity = (activityId: string) => {
    if (!currentTrip) return;

    const updatedActivities = removeActivityAndReindex(currentTrip.activities, activityId);
    const updatedTrip: TripItinerary = {
      ...currentTrip,
      activities: updatedActivities,
      updatedAt: new Date().toISOString(),
    };

    setCurrentTrip(updatedTrip);
    setSavedTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
  };

  // 4. Move Activity between days
  const handleMoveActivityToDay = (activityId: string, targetDayNumber: number) => {
    if (!currentTrip) return;

    const updatedActivities = moveActivityToDayAndIndex(
      currentTrip.activities,
      activityId,
      targetDayNumber
    );

    const updatedTrip: TripItinerary = {
      ...currentTrip,
      activities: updatedActivities,
      updatedAt: new Date().toISOString(),
    };

    setCurrentTrip(updatedTrip);
    setSavedTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
  };

  // 5. Drag and Drop: Move Activity to target day & specific index
  const handleMoveActivityPosition = (
    activityId: string,
    targetDayNumber: number,
    targetIndex: number
  ) => {
    if (!currentTrip) return;

    const updatedActivities = moveActivityToDayAndIndex(
      currentTrip.activities,
      activityId,
      targetDayNumber,
      targetIndex
    );

    const updatedTrip: TripItinerary = {
      ...currentTrip,
      activities: updatedActivities,
      updatedAt: new Date().toISOString(),
    };

    setCurrentTrip(updatedTrip);
    setSavedTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
  };

  // 6. Reorder activities within a day using ordered ID list
  const handleReorderActivitiesForDay = (dayNumber: number, orderedActivityIds: string[]) => {
    if (!currentTrip) return;

    const updatedActivities = reorderDayActivities(
      currentTrip.activities,
      dayNumber,
      orderedActivityIds
    );

    const updatedTrip: TripItinerary = {
      ...currentTrip,
      activities: updatedActivities,
      updatedAt: new Date().toISOString(),
    };

    setCurrentTrip(updatedTrip);
    setSavedTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
  };

  // 7. Step Reorder Activity within Day (Up/Down)
  const handleReorderActivity = (activityId: string, direction: 'up' | 'down') => {
    if (!currentTrip) return;

    const activity = currentTrip.activities.find((a) => a.id === activityId);
    if (!activity) return;

    const dayActivities = currentTrip.activities
      .filter((a) => a.dayNumber === activity.dayNumber)
      .sort((a, b) => a.order - b.order);

    const currentIndex = dayActivities.findIndex((a) => a.id === activityId);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= dayActivities.length) return;

    const targetActivity = dayActivities[targetIndex];

    const updatedActivities = currentTrip.activities.map((a) => {
      if (a.id === activity.id) return { ...a, order: targetActivity.order };
      if (a.id === targetActivity.id) return { ...a, order: activity.order };
      return a;
    });

    const updatedTrip: TripItinerary = {
      ...currentTrip,
      activities: updatedActivities,
      updatedAt: new Date().toISOString(),
    };

    setCurrentTrip(updatedTrip);
    setSavedTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
  };

  // 8. Add Manual Activity
  const handleAddManualActivity = (
    dayNumber: number,
    title: string,
    timeSlot?: string,
    notes?: string
  ) => {
    if (!currentTrip) return;

    const dayActivities = currentTrip.activities.filter((a) => a.dayNumber === dayNumber);

    const newActivity: TripActivity = {
      id: `act_man_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tripId: currentTrip.id,
      placeId: `custom_${Date.now()}`,
      customTitle: title,
      dayNumber,
      order: dayActivities.length + 1,
      timeSlot,
      notes,
      isVisited: false,
      createdAt: new Date().toISOString(),
    };

    const updatedTrip: TripItinerary = {
      ...currentTrip,
      activities: [...currentTrip.activities, newActivity],
      updatedAt: new Date().toISOString(),
    };

    setCurrentTrip(updatedTrip);
    setSavedTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
  };

  // 9. Update Notes
  const handleUpdateNotes = (notes: string) => {
    if (!currentTrip) return;
    const updatedTrip: TripItinerary = { ...currentTrip, notes, updatedAt: new Date().toISOString() };
    setCurrentTrip(updatedTrip);
    setSavedTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
  };

  if (currentRoute === 'admin') {
    if (isAdmin) {
      return <AdminLayout onGoToPublicApp={() => navigateTo('public')} />;
    }
    return (
      <LoginPage
        onBackToApp={() => navigateTo('public')}
        onLoginSuccess={() => navigateTo('admin')}
      />
    );
  }

  if (currentRoute === 'login') {
    return (
      <LoginPage
        onBackToApp={() => navigateTo('public')}
        onLoginSuccess={() => navigateTo(isAdmin ? 'admin' : 'public')}
      />
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-[#F8F9FA] text-[#17243A] antialiased">
      {/* 
        Single Unified Header Bar:
        Always visible, fixed height (h-14 shrink-0), consistent across all views.
      */}
      <Header
        currentTrip={currentTrip}
        activeView={activeView}
        setActiveView={(view) => {
          setActiveView(view);
          if (view === 'workspace') {
            setActiveSection('overview');
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          }
        }}
        onOpenCreateModal={() => {
          setModalTargetDestinationId('trujillo');
          setIsCreateModalOpen(true);
        }}
        onEditTrip={() => {
          if (currentTrip) {
            setModalTargetDestinationId(currentTrip.destinationId);
            setIsCreateModalOpen(true);
          }
        }}
        onUpdateTripTitle={handleUpdateTripTitle}
        onOpenArchitectureModal={() => setIsArchitectureModalOpen(true)}
        onOpenAdmin={() => navigateTo('admin')}
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        isMapCollapsed={isMapCollapsed}
        onToggleMapCollapse={() => setIsMapCollapsed((prev) => !prev)}
      />

      {/* Main Viewport Container: strictly bounded to available height */}
      <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
        {activeView === 'destinations' ? (
          <div className="flex-1 min-h-0 min-w-0 overflow-y-auto">
            <DestinationsGallery
              onSelectDestinationForTrip={(locId) => {
                setModalTargetDestinationId(locId);
                setIsCreateModalOpen(true);
              }}
            />
          </div>
        ) : !currentTrip ? (
          /* Flujo Inicial Simplificado de Creación de Viaje */
          <TripCreationScreen
            onTripCreated={handleTripCreated}
            savedTrips={savedTrips}
            onSelectSavedTrip={handleSelectSavedTrip}
          />
        ) : (
          /* Workspace: Sidebar + Contenido Central + Mapa Persistente */
          <div className="h-full flex-1 min-h-0 min-w-0 flex flex-col lg:flex-row overflow-hidden">
            {/* Contenedor de Planificación (Sidebar + Contenido Central) */}
            <div
              className={`h-full min-h-0 ${
                mobileTab === 'content' ? 'flex flex-col md:flex-row flex-1 min-w-0' : 'hidden'
              } lg:flex ${isMapCollapsed ? 'flex-1 min-w-0' : 'lg:flex-initial min-w-0'} transition-all z-10 shrink-0`}
            >
              {/* Barra lateral de navegación */}
              <WorkspaceSidebar
                trip={currentTrip}
                activeSection={activeSection}
                onSelectSection={(section) => {
                  setActiveSection(section);
                  setPreviousSection(null);
                  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                }}
                selectedDayNumber={selectedDayNumber}
                onSelectDayNumber={setSelectedDayNumber}
                totalPlacesCount={places.length}
              />

              {/* Área central con el contenido de la sección activa */}
              <WorkspaceContent
                trip={currentTrip}
                places={places}
                selectedPlace={selectedPlace}
                onSelectPlace={handleSelectPlace}
                activeSection={activeSection}
                onSelectSection={setActiveSection}
                selectedDayNumber={selectedDayNumber}
                onSelectDayNumber={setSelectedDayNumber}
                onAddPlaceToDay={handleAddPlaceToDay}
                onToggleSavePlace={handleToggleSavePlace}
                onRemoveActivity={handleRemoveActivity}
                onMoveActivityToDay={handleMoveActivityToDay}
                onMoveActivityPosition={handleMoveActivityPosition}
                onReorderActivitiesForDay={handleReorderActivitiesForDay}
                onReorderActivity={handleReorderActivity}
                onAddManualActivity={handleAddManualActivity}
                onUpdateNotes={handleUpdateNotes}
                isMapCollapsed={isMapCollapsed}
                previousSection={previousSection}
                onReturnToPreviousSection={handleReturnToPreviousSection}
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
                selectedLocality={selectedLocality}
                onLocalityChange={handleLocalityChange}
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
              />
            </div>

            {/* Panel Derecho: Mapa Persistente MapLibre */}
            <div
              className={`h-full min-h-0 ${
                mobileTab === 'map' ? 'flex flex-1 min-w-0' : 'hidden'
              } ${isMapCollapsed ? 'lg:flex lg:w-12 lg:flex-none' : 'lg:flex flex-1 min-w-0'} relative overflow-hidden transition-all`}
            >
              <MapPanel
                trip={currentTrip}
                places={places}
                selectedPlace={selectedPlace}
                onSelectPlace={handleSelectPlace}
                onAddPlaceToDay={(place, day) => handleAddPlaceToDay(place, day)}
                onRemoveActivity={handleRemoveActivity}
                onToggleSavePlace={handleToggleSavePlace}
                selectedDayNumber={selectedDayNumber}
                onSelectDayNumber={setSelectedDayNumber}
                activeSection={activeSection}
                onSelectSection={setActiveSection}
                isCollapsed={isMapCollapsed}
                onToggleCollapse={() => setIsMapCollapsed((prev) => !prev)}
                mobileTab={mobileTab}
                onSwitchToContent={() => setMobileTab('content')}
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
                selectedLocality={selectedLocality}
                onLocalityChange={handleLocalityChange}
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
              />
            </div>
          </div>
        )}
      </main>

      {/* Modal de Creación / Edición de Viaje */}
      <CreateTripModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTripCreated={handleTripCreated}
        initialDestinationId={modalTargetDestinationId}
      />

      {/* Modal de Arquitectura MVP */}
      <ArchitectureModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
