import React, { useState, useEffect } from 'react';
import { X, History, User, RefreshCw, ArrowRight } from 'lucide-react';
import { VideoModerationLog, ModerationStatus } from '../../types/creators.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface VideoHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle: string;
}

const statusBadgeColor = (status?: ModerationStatus | null) => {
  switch (status) {
    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'PENDING':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'OBSERVED':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'REJECTED':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'HIDDEN':
      return 'bg-slate-200 text-slate-700 border-slate-300';
    default:
      return 'bg-slate-100 text-slate-500 border-slate-200';
  }
};

const actionBadgeStyle = (action?: string) => {
  switch (action) {
    case 'CREATE':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-300';
    case 'APPROVE':
      return 'bg-green-500/10 text-green-700 border-green-300';
    case 'REJECT':
      return 'bg-rose-500/10 text-rose-700 border-rose-300';
    case 'OBSERVE':
      return 'bg-amber-500/10 text-amber-700 border-amber-300';
    case 'HIDE':
      return 'bg-slate-500/10 text-slate-700 border-slate-300';
    case 'UPDATE':
    default:
      return 'bg-sky-500/10 text-sky-700 border-sky-300';
  }
};

const actionLabels: Record<string, string> = {
  CREATE: 'REGISTRO DIRECTO',
  UPDATE: 'EDICIÓN',
  APPROVE: 'APROBADO',
  REJECT: 'RECHAZADO',
  OBSERVE: 'OBSERVADO',
  HIDE: 'OCULTADO',
};

export const VideoHistoryModal: React.FC<VideoHistoryModalProps> = ({
  isOpen,
  onClose,
  videoId,
  videoTitle,
}) => {
  const { token } = useAuth();
  const [logs, setLogs] = useState<VideoModerationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !videoId) return;
    setIsLoading(true);
    fetch(`/api/admin/moderation/${videoId}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setLogs(json.data);
        } else {
          setLogs([]);
        }
      })
      .catch(() => setLogs([]))
      .finally(() => setIsLoading(false));
  }, [isOpen, videoId, token]);

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
                Historial de Moderación del Video
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1 max-w-md">
                {videoTitle} • <span className="font-mono text-[10px]">{videoId}</span>
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
              <span>Cargando historial de auditoría...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No se han registrado acciones de moderación previas para este video.
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
              {logs.map((log) => {
                const actionKey = log.action || 'UPDATE';
                return (
                  <div key={log.id} className="relative pl-6">
                    {/* Timeline dot */}
                    <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-[#E85B49]" />

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <span className={`px-2 py-0.5 rounded font-bold border tracking-wider uppercase text-[9px] ${actionBadgeStyle(actionKey)}`}>
                            {actionLabels[actionKey] || actionKey}
                          </span>
                          {log.previousStatus ? (
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded border font-semibold ${statusBadgeColor(log.previousStatus)}`}>
                                {log.previousStatus}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className={`px-2 py-0.5 rounded border font-semibold ${statusBadgeColor(log.newStatus)}`}>
                                {log.newStatus}
                              </span>
                            </div>
                          ) : (
                            <span className={`px-2 py-0.5 rounded border font-semibold ${statusBadgeColor(log.newStatus)}`}>
                              Estado: {log.newStatus}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.createdAt).toLocaleString('es-PE')}
                        </span>
                      </div>

                      {log.changedFields && log.changedFields.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-700">Campos modificados:</span>
                          {log.changedFields.map((field) => (
                            <span
                              key={field}
                              className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 font-mono text-[10px]"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      )}

                      {log.reason && (
                        <p className="text-xs font-medium text-slate-800">
                          {log.reason}
                        </p>
                      )}

                      {log.internalNotes && (
                        <div className="text-[11px] bg-slate-100 rounded px-2.5 py-1.5 text-slate-600 font-mono">
                          <span className="font-semibold text-slate-700">Nota interna:</span> {log.internalNotes}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{log.adminName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
