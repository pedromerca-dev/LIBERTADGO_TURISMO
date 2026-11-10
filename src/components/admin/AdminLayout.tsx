import React, { useState } from 'react';
import { AdminSidebar, AdminSection } from './AdminSidebar.tsx';
import { AdminHeader } from './AdminHeader.tsx';
import { DashboardView } from './DashboardView.tsx';
import { PlacesListView } from './PlacesListView.tsx';
import { CategoriesView } from './CategoriesView.tsx';
import { LocalitiesView } from './LocalitiesView.tsx';
import { SourcesView } from './SourcesView.tsx';
import { DuplicatesView } from './DuplicatesView.tsx';
import { AuditView } from './AuditView.tsx';
import { AdminCreatorModerationView } from './AdminCreatorModerationView.tsx';
import { PlaceEditorModal } from './PlaceEditorModal.tsx';
import { PlaceHistoryModal } from './PlaceHistoryModal.tsx';
import { AdminPlaceRecord } from '../../types/adminCatalog.ts';

interface AdminLayoutProps {
  onGoToPublicApp: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onGoToPublicApp }) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');

  // Place editing state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<AdminPlaceRecord | null>(null);

  // Place history audit modal state
  const [historyPlace, setHistoryPlace] = useState<{ id: string; name: string } | null>(null);

  const handleOpenCreateModal = () => {
    setEditingPlace(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (place: AdminPlaceRecord) => {
    setEditingPlace(place);
    setIsEditorOpen(true);
  };

  const handleViewPlaceHistory = (placeId: string, placeName: string) => {
    setHistoryPlace({ id: placeId, name: placeName });
  };

  const handleFilterByCategory = (category: string) => {
    setActiveSection('places');
  };

  const handleFilterByLocality = (localityId: string) => {
    setActiveSection('places');
  };

  return (
    <div className="h-dvh flex overflow-hidden bg-slate-100 font-sans antialiased text-slate-800">
      {/* Sidebar */}
      <AdminSidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onGoToPublicApp={onGoToPublicApp}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader
          activeSection={activeSection}
          onGoToPublicApp={onGoToPublicApp}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50">
          {activeSection === 'dashboard' && (
            <DashboardView
              onNavigateSection={setActiveSection}
              onOpenCreatePlaceModal={handleOpenCreateModal}
            />
          )}

          {activeSection === 'places' && (
            <PlacesListView
              onEditPlace={handleOpenEditModal}
              onCreatePlace={handleOpenCreateModal}
              onViewPlaceHistory={handleViewPlaceHistory}
            />
          )}

          {activeSection === 'categories' && (
            <CategoriesView onFilterByCategory={handleFilterByCategory} />
          )}

          {activeSection === 'localities' && (
            <LocalitiesView onFilterByLocality={handleFilterByLocality} />
          )}

          {activeSection === 'sources' && <SourcesView />}

          {activeSection === 'duplicates' && <DuplicatesView />}

          {activeSection === 'audit' && <AuditView />}

          {activeSection === 'creators' && <AdminCreatorModerationView />}
        </main>
      </div>

      {/* Place Editor Dialog */}
      <PlaceEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onPlaceSaved={() => {
          // Trigger refresh if needed
        }}
        initialPlace={editingPlace}
      />

      {/* Place History Audit Dialog */}
      {historyPlace && (
        <PlaceHistoryModal
          isOpen={Boolean(historyPlace)}
          onClose={() => setHistoryPlace(null)}
          placeId={historyPlace.id}
          placeName={historyPlace.name}
        />
      )}
    </div>
  );
};
