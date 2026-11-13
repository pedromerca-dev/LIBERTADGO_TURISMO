import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Shield, Eye, LogOut } from 'lucide-react';
import { AdminSection } from './AdminSidebar.tsx';

interface AdminHeaderProps {
  activeSection: AdminSection;
  onGoToPublicApp: () => void;
}

const sectionTitles: Record<AdminSection, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Panel General',
    subtitle: 'Indicadores globales y métricas del catálogo turístico de La Libertad',
  },
  places: {
    title: 'Gestión de Lugares Turísticos',
    subtitle: 'Catálogo oficial de 297 atractivos, gastronomía y servicios',
  },
  categories: {
    title: 'Categorías Turísticas',
    subtitle: 'Estructuración temática del catálogo regional',
  },
  localities: {
    title: 'Localidades de La Libertad',
    subtitle: 'Distribución territorial por distritos y provincias',
  },
  sources: {
    title: 'Fuentes de Información',
    subtitle: 'Trazabilidad de datos (MINCETUR, OpenStreetMap y directorios oficiales)',
  },
  duplicates: {
    title: 'Detección de Duplicados',
    subtitle: 'Identificación algorítmica y fusión controlada sin pérdida de datos',
  },
  audit: {
    title: 'Historial de Auditoría',
    subtitle: 'Registro inmutable de todas las mutaciones realizadas por administradores',
  },
  creators: {
    title: 'Videos y Creadores',
    subtitle: 'Gestión editorial de videos turísticos y directorio regional de creadores',
  },
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeSection,
  onGoToPublicApp,
}) => {
  const { user, logout } = useAuth();
  const info = sectionTitles[activeSection] || sectionTitles.dashboard;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-10 shadow-xs">
      <div>
        <h1 className="text-base font-bold text-slate-900 tracking-tight">
          {info.title}
        </h1>
        <p className="text-xs text-slate-500">
          {info.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Role badge */}
        <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
          <Shield className="w-3.5 h-3.5 text-[#E85B49]" />
          <span>Rol: <strong className="text-slate-900 font-semibold">{user?.role || 'ADMIN'}</strong></span>
        </div>

        {/* View public app */}
        <button
          onClick={onGoToPublicApp}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-slate-500" />
          <span>Ver App Pública</span>
        </button>

        {/* Logout */}
        <button
          onClick={() => logout()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cerrar Sesión</span>
        </button>
      </div>
    </header>
  );
};
