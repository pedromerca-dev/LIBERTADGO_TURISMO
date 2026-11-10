import React, { useState, useEffect } from 'react';
import {
  CopyX,
  AlertTriangle,
  ArrowRight,
  GitMerge,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { DuplicatePair } from '../../types/adminCatalog.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const DuplicatesView: React.FC = () => {
  const { token } = useAuth();
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDuplicates = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/duplicates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setDuplicates(json.data);
      }
    } catch (err) {
      setErrorMessage('Error al consultar posibles duplicados');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, [token]);

  const handleMerge = async (pair: DuplicatePair) => {
    setMergingId(pair.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/admin/duplicates/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          primaryId: pair.primaryPlace.id,
          duplicateIds: [pair.duplicatePlace.id],
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al fusionar lugares');
      }

      setSuccessMessage(
        `Fusión completada: "${pair.duplicatePlace.name}" fue integrado y archivado hacia "${pair.primaryPlace.name}".`
      );

      // Remove from view
      setDuplicates((prev) => prev.filter((p) => p.id !== pair.id));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error durante la fusión');
    } finally {
      setMergingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-[#E85B49]" />
        <span>Analizando catálogo en busca de duplicados y proximidades...</span>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Detección y Fusión de Duplicados
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Algoritmo inteligente de similitud fonética, solapamiento textual y proximidad métrica GPS (&lt;150m)
          </p>
        </div>

        <button
          onClick={fetchDuplicates}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Volver a escanear</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {duplicates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            ¡Excelente! No se detectaron duplicados en el catálogo
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            El catálogo regional de La Libertad mantiene integridad completa de identidades, identificadores únicos y coordenadas verificadas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {duplicates.length} pares de duplicados identificados
          </div>

          {duplicates.map((pair) => {
            const isMerging = mergingId === pair.id;

            return (
              <div
                key={pair.id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
              >
                {/* Header of the pair */}
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">Coincidencia Algorítmica</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                      {Math.round(pair.similarityScore * 100)}% similitud
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      Distancia: <strong>{pair.distanceMeters}m</strong>
                    </span>
                  </div>

                  <button
                    onClick={() => handleMerge(pair)}
                    disabled={isMerging}
                    className="px-4 py-1.5 bg-[#E85B49] hover:bg-[#d64f3e] disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>{isMerging ? 'Fusionando...' : 'Fusionar Lugares'}</span>
                  </button>
                </div>

                {/* Reasons list */}
                <div className="px-5 py-2.5 bg-amber-50/60 border-b border-amber-100 flex flex-wrap items-center gap-2 text-[11px] text-amber-900">
                  <span className="font-semibold">Motivos de detección:</span>
                  {pair.reasons.map((r, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-white border border-amber-200 font-medium"
                    >
                      {r}
                    </span>
                  ))}
                </div>

                {/* Side by side cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  {/* Primary Place */}
                  <div className="p-5 space-y-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Lugar Principal (Se conservará)
                      </span>
                      <span className="font-mono text-slate-400 text-[10px]">ID: {pair.primaryPlace.id}</span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">{pair.primaryPlace.name}</h4>
                    <p className="text-xs text-slate-600">{pair.primaryPlace.shortDescription}</p>

                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                      <div>Dirección: <strong>{pair.primaryPlace.address}</strong></div>
                      <div>Categoría: <strong className="capitalize">{pair.primaryPlace.category}</strong> • {pair.primaryPlace.localityName}</div>
                      <div>Imágenes: {pair.primaryPlace.images.length} • Estado: {pair.primaryPlace.status}</div>
                    </div>
                  </div>

                  {/* Duplicate Place */}
                  <div className="p-5 space-y-2 bg-slate-50/50">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Candidato Duplicado (Se archivará)
                      </span>
                      <span className="font-mono text-slate-400 text-[10px]">ID: {pair.duplicatePlace.id}</span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">{pair.duplicatePlace.name}</h4>
                    <p className="text-xs text-slate-600">{pair.duplicatePlace.shortDescription}</p>

                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                      <div>Dirección: <strong>{pair.duplicatePlace.address}</strong></div>
                      <div>Categoría: <strong className="capitalize">{pair.duplicatePlace.category}</strong> • {pair.duplicatePlace.localityName}</div>
                      <div>Imágenes: {pair.duplicatePlace.images.length} • Estado: {pair.duplicatePlace.status}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
