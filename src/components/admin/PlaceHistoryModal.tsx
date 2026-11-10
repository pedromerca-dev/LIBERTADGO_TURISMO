import React, { useState, useEffect } from 'react';
import { X, History, User, Clock, RefreshCw } from 'lucide-react';
import { PlaceAuditEntry } from '../../types/adminCatalog.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface PlaceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  placeId: string;
  placeName: string;
}

export const PlaceHistoryModal: React.FC<PlaceHistoryModalProps> = ({
  isOpen,
  onClose,
  placeId,
  placeName,
}) => {
  const { token } = useAuth();
  const [history, setHistory] = useState<PlaceAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !placeId) return;
    setIsLoading(true);
    fetch(`/api/admin/places/${placeId}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setHistory(json.data);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isOpen, placeId, token]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-slate-800">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E85B49]/15 text-[#E85B49] flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Historial de Trazabilidad y Cambios
              </h3>
              <p className="text-xs text-slate-500">
                {placeName} • <span className="font-mono text-[10px]">{placeId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#E85B49]" />
              <span>Cargando eventos de auditoría...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No se han registrado modificaciones administrativas para este lugar aún.
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
              {history.map((event) => (
                <div key={event.id} className="relative pl-6">
                  {/* Timeline dot */}
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-[#E85B49]" />

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                          event.action === 'CREATE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : event.action === 'UPDATE'
                            ? 'bg-blue-100 text-blue-800'
                            : event.action === 'STATUS_CHANGE'
                            ? 'bg-amber-100 text-amber-800'
                            : event.action === 'MERGE'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {event.action}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(event.createdAt).toLocaleString('es-PE')}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-800">
                      {event.changeSummary}
                    </p>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{event.adminName}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
