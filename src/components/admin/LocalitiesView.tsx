import React, { useState, useEffect } from 'react';
import { Map as MapIcon, MapPin, CheckCircle2, ArrowRight, RefreshCw, Compass } from 'lucide-react';
import { LA_LIBERTAD_LOCALITIES } from '../../types/geo.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface LocalityStat {
  localityId: string;
  localityName: string;
  count: number;
  published: number;
}

interface LocalitiesViewProps {
  onFilterByLocality: (localityId: string) => void;
}

export const LocalitiesView: React.FC<LocalitiesViewProps> = ({ onFilterByLocality }) => {
  const { token } = useAuth();
  const [localitiesStats, setLocalitiesStats] = useState<LocalityStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/localities', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setLocalitiesStats(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-[#E85B49]" />
        <span>Cargando localidades de La Libertad...</span>
      </div>
    );
  }

  const statsMap = new Map(localitiesStats.map((s) => [s.localityId, s]));
  const totalPlaces = localitiesStats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Localidades de La Libertad
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            10 polos turísticos delimitados con control de fronteras geográficas oficiales
          </p>
        </div>
        <div className="text-xs text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs font-medium">
          10 localidades • {totalPlaces} lugares distribuidos
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LA_LIBERTAD_LOCALITIES.map((loc) => {
          const stat = statsMap.get(loc.id) || { count: 0, published: 0 };
          const percentage = totalPlaces > 0 ? Math.round((stat.count / totalPlaces) * 100) : 0;

          return (
            <div
              key={loc.id}
              className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{loc.name}</h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase border border-slate-200">
                        {loc.province}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#E85B49] font-medium mt-0.5">
                      {loc.highlights ? loc.highlights.slice(0, 2).join(' • ') : 'Polo Turístico Regional'}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono text-slate-900">
                      {stat.count} lugares
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {percentage}% del total
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mb-3">{loc.description}</p>

                {/* GPS Coordinates preview */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-mono text-slate-600 flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-slate-400" />
                    <span>Centro GPS: {loc.coordinates.lat.toFixed(4)}, {loc.coordinates.lng.toFixed(4)}</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Dentro de La Libertad
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  <strong className="text-slate-800">{stat.published}</strong> publicados en el planificador
                </div>

                <button
                  onClick={() => onFilterByLocality(loc.id)}
                  className="text-xs text-[#E85B49] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver {stat.count} lugares</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
