import React, { useState, useEffect } from 'react';
import { History, Search, RefreshCw, Filter, FileText, User } from 'lucide-react';
import { PlaceAuditEntry } from '../../types/adminCatalog.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const AuditView: React.FC = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState<PlaceAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/audit?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setLogs(json.data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [token]);

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        log.changeSummary.toLowerCase().includes(q) ||
        log.adminName.toLowerCase().includes(q) ||
        log.placeId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Registro Inmutable de Auditoría
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Trazabilidad completa de creaciones, ediciones, verificaciones y fusiones de lugares
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualizar registro</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por resumen, administrador o ID de lugar..."
            className="w-full text-xs pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E85B49]"
          >
            <option value="ALL">Todas las Acciones</option>
            <option value="CREATE">CREATE (Creación)</option>
            <option value="UPDATE">UPDATE (Edición)</option>
            <option value="STATUS_CHANGE">STATUS_CHANGE (Estado)</option>
            <option value="VERIFY">VERIFY (Verificación)</option>
            <option value="MERGE">MERGE (Fusión)</option>
            <option value="ARCHIVE">ARCHIVE (Archivo)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#E85B49]" />
            <span>Consultando registro de auditoría...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No se encontraron eventos de auditoría para este filtro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Acción</th>
                  <th className="py-3 px-4">Lugar Afectado</th>
                  <th className="py-3 px-4">Resumen del Cambio</th>
                  <th className="py-3 px-4">Administrador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                      {new Date(log.createdAt).toLocaleString('es-PE')}
                    </td>
                    <td className="py-3 px-4">
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
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {log.placeId}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 max-w-md">
                      {log.changeSummary}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{log.adminName}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
