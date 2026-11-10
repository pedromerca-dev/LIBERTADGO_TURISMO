import React, { useState, useEffect } from 'react';
import { Video, Check, X, Eye, AlertCircle, RefreshCw, ExternalLink, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { VideoSubmission, ModerationStatus } from '../../types/creators.ts';

export const AdminCreatorModerationView: React.FC = () => {
  const { token } = useAuth();
  const [queue, setQueue] = useState<VideoSubmission[]>([]);
  const [statusFilter, setStatusFilter] = useState<ModerationStatus>('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/moderation/queue?status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setQueue(json.data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [statusFilter, token]);

  const handleAction = async (id: string, action: 'APPROVE' | 'REJECT' | 'OBSERVE', reason?: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/moderation/${id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          reason: reason || `Acción administrativa: ${action}`,
        }),
      });

      if (res.ok) {
        setQueue((prev) => prev.filter((v) => v.id !== id));
      }
    } catch {
      // ignore
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Moderación de Videos de Creadores
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bandeja de revisión editorial para videos de TikTok, Instagram Reels y YouTube Shorts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ModerationStatus)}
            className="text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] font-medium"
          >
            <option value="PENDING">Pendientes de Revisión</option>
            <option value="APPROVED">Aprobados</option>
            <option value="OBSERVED">Observados</option>
            <option value="REJECTED">Rechazados</option>
          </select>

          <button
            onClick={fetchQueue}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#E85B49]" />
          <span>Consultando bandeja de moderación...</span>
        </div>
      ) : queue.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-400">
          No hay videos en la bandeja para el estado seleccionado ({statusFilter}).
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {queue.map((sub) => {
            const isProcessing = processingId === sub.id;

            return (
              <div
                key={sub.id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                    {sub.thumbnailUrl ? (
                      <img
                        src={sub.thumbnailUrl}
                        alt={sub.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Video className="w-8 h-8 text-slate-600" />
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-white font-mono text-[10px] uppercase">
                      {sub.platform}
                    </span>
                  </div>

                  <div className="p-4 space-y-2">
                    <h3 className="font-bold text-slate-900 text-xs line-clamp-2">
                      {sub.title}
                    </h3>
                    <p className="text-slate-500 text-[11px] line-clamp-2">
                      {sub.description || 'Sin descripción'}
                    </p>

                    <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
                      <span className="capitalize">{sub.category}</span>
                      <a
                        href={sub.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#E85B49] hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>Ver video original</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleAction(sub.id, 'REJECT')}
                    disabled={isProcessing}
                    className="flex-1 py-1.5 px-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Rechazar</span>
                  </button>

                  <button
                    onClick={() => handleAction(sub.id, 'APPROVE')}
                    disabled={isProcessing}
                    className="flex-1 py-1.5 px-3 bg-[#E85B49] hover:bg-[#d64f3e] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Aprobar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
