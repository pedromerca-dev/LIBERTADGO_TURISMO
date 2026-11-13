import React, { useState, useEffect } from 'react';
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Archive,
  CopyX,
  FileText,
  TrendingUp,
  Clock,
  ArrowRight,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { AdminDashboardMetrics } from '../../types/adminCatalog.ts';

import { AdminSection } from './AdminSidebar.tsx';

interface DashboardViewProps {
  onNavigateSection: (section: AdminSection) => void;
  onOpenCreatePlaceModal: () => void;
  refreshKey: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateSection,
  onOpenCreatePlaceModal,
  refreshKey,
}) => {
  
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/dashboard', {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Error al cargar métricas del panel administrativo');
      }

      const json = await res.json();
      if (json.success) {
        setMetrics(json.data);
      } else {
        throw new Error(json.error || 'Error desconocido');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [refreshKey]);

  if (isLoading && !metrics) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-[#E85B49]" />
          <span>Cargando indicadores del catálogo turístico...</span>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="p-8">
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchDashboardData}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-medium cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const m = metrics!;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner with Quick Actions */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#E85B49]/20 text-[#E85B49] text-[11px] font-semibold tracking-wide uppercase mb-2">
            Región La Libertad, Perú
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Catálogo Oficial de Turismo — Estado del Sistema
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Control de inventario de 297 lugares registrados, verificación MINCETUR, detección de duplicados y trazabilidad inmutable.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={fetchDashboardData}
            title="Recargar datos"
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenCreatePlaceModal}
            className="px-4 py-2.5 bg-[#E85B49] hover:bg-[#d64f3e] text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nuevo Lugar</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Places */}
        <div
          onClick={() => onNavigateSection('places')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Total Lugares</span>
            <MapPin className="w-4 h-4 text-slate-400 group-hover:text-[#E85B49] transition-colors" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">{m.totalPlaces}</div>
          <div className="text-[10px] text-slate-500 mt-1">100% regional La Libertad</div>
        </div>

        {/* Published */}
        <div
          onClick={() => onNavigateSection('places')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-700">Publicados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 tracking-tight">{m.publishedCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">Visibles en planificador</div>
        </div>

        {/* Drafts */}
        <div
          onClick={() => onNavigateSection('places')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Borradores</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-700 tracking-tight">{m.draftCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">En preparación</div>
        </div>

        {/* Flagged / Observados */}
        <div
          onClick={() => onNavigateSection('places')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-amber-700">Observados</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700 tracking-tight">{m.flaggedCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">Requieren revisión</div>
        </div>

        {/* Official Verified */}
        <div
          onClick={() => onNavigateSection('places')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-blue-700">Verificados</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-700 tracking-tight">{m.verifiedCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">MINCETUR / Oficiales</div>
        </div>

        {/* Potential Duplicates */}
        <div
          onClick={() => onNavigateSection('duplicates')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-rose-700">Duplicados</span>
            <CopyX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-700 tracking-tight">{m.potentialDuplicatesCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">Candidatos a fusión</div>
        </div>
      </div>

      {/* Distributions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution by Category */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#E85B49]" />
              <h3 className="text-sm font-bold text-slate-900">Distribución por Categorías</h3>
            </div>
            <button
              onClick={() => onNavigateSection('categories')}
              className="text-xs text-[#E85B49] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todas</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {m.placesByCategory.slice(0, 7).map((cat) => {
              const percentage = Math.round((cat.count / m.totalPlaces) * 100);
              return (
                <div key={cat.category} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700 capitalize">{cat.category}</span>
                    <span className="text-slate-500 font-mono">
                      {cat.count} lugares ({percentage}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E85B49] rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribution by Locality */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#E85B49]" />
              <h3 className="text-sm font-bold text-slate-900">Distribución Territorial (La Libertad)</h3>
            </div>
            <button
              onClick={() => onNavigateSection('localities')}
              className="text-xs text-[#E85B49] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Ver 10 localidades</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {m.placesByLocality.slice(0, 7).map((loc) => {
              const percentage = Math.round((catCount(loc.count, m.totalPlaces)) * 100);
              return (
                <div key={loc.localityId} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{loc.localityName}</span>
                    <span className="text-slate-500 font-mono">
                      {loc.count} lugares ({percentage}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-800 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Audit Stream */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">Actividad Reciente y Auditoría</h3>
          </div>
          <button
            onClick={() => onNavigateSection('audit')}
            className="text-xs text-[#E85B49] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Ver historial completo</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {m.recentAuditLogs && m.recentAuditLogs.length > 0 ? (
            m.recentAuditLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="p-4 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                        log.action === 'CREATE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.action === 'UPDATE'
                          ? 'bg-blue-100 text-blue-800'
                          : log.action === 'STATUS_CHANGE'
                          ? 'bg-amber-100 text-amber-800'
                          : log.action === 'MERGE'
                          ? 'bg-purple-100 text-purple-800'
                          : log.action === 'ARCHIVE'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {new Date(log.createdAt).toLocaleString('es-PE')}
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium">{log.changeSummary}</p>
                  <p className="text-[11px] text-slate-400">Por: {log.adminName}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-xs text-slate-400">
              No hay registros de auditoría aún.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function catCount(count: number, total: number): number {
  if (total <= 0) return 0;
  return count / total;
}
