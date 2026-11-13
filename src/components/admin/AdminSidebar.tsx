import React from 'react';
import {
  LayoutDashboard,
  MapPin,
  Tag,
  Map,
  Database,
  CopyX,
  History,
  Video,
  ExternalLink,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { RiyMoLogo } from '../common/RiyMoLogo.tsx';

export type AdminSection =
  | 'dashboard'
  | 'places'
  | 'categories'
  | 'localities'
  | 'sources'
  | 'duplicates'
  | 'audit'
  | 'creators';

interface AdminSidebarProps {
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  onGoToPublicApp: () => void;
  counts?: {
    places?: number;
    duplicates?: number;
    pendingVideos?: number;
  };
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeSection,
  onSelectSection,
  onGoToPublicApp,
  counts,
}) => {
  const { user, logout } = useAuth();

  const navItems: Array<{
    id: AdminSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }> = [
    { id: 'dashboard', label: 'Panel General', icon: LayoutDashboard },
    {
      id: 'places',
      label: 'Lugares Turísticos',
      icon: MapPin,
      badge: counts?.places,
    },
    { id: 'categories', label: 'Categorías', icon: Tag },
    { id: 'localities', label: 'Localidades', icon: Map },
    { id: 'sources', label: 'Fuentes de Datos', icon: Database },
    {
      id: 'duplicates',
      label: 'Detección Duplicados',
      icon: CopyX,
      badge: counts?.duplicates,
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    },
    { id: 'audit', label: 'Registro de Auditoría', icon: History },
    {
      id: 'creators',
      label: 'Videos y Creadores',
      icon: Video,
      badge: counts?.pendingVideos,
    },
  ];

  return (
    <aside className="w-64 bg-[#0F172A] border-r border-slate-800 flex flex-col shrink-0 text-slate-300">
      {/* Brand logo & header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <RiyMoLogo variant="full" theme="dark" size="sm" showSubtitle={false} />
          <span className="text-[10px] text-slate-400 font-mono tracking-wide uppercase px-1.5 py-0.5 rounded bg-slate-800">
            Admin
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider uppercase text-slate-400">
          Catálogo & Gestión
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#E85B49] text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isActive
                      ? 'bg-black/20 text-white'
                      : item.badgeColor || 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-4 px-3 pb-2 text-[10px] font-semibold tracking-wider uppercase text-slate-400">
          Accesos Externos
        </div>

        <button
          onClick={onGoToPublicApp}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <ExternalLink className="w-4 h-4 text-slate-400" />
            <span>Ver Planificador Turístico</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </nav>

      {/* Admin User Profile footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-[#E85B49] shrink-0">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-white truncate">
                {user?.name || 'Administrador'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {user?.email || 'admin@riymo.pe'}
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Cerrar sesión"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
