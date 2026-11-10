import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Archive,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  History,
} from 'lucide-react';
import { AdminPlaceRecord, PlaceStatus } from '../../types/adminCatalog.ts';
import { PlaceCategory } from '../../types/catalog.ts';
import { LA_LIBERTAD_LOCALITIES } from '../../types/geo.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface PlacesListViewProps {
  onEditPlace: (place: AdminPlaceRecord) => void;
  onCreatePlace: () => void;
  onViewPlaceHistory: (placeId: string, placeName: string) => void;
}

export const PlacesListView: React.FC<PlacesListViewProps> = ({
  onEditPlace,
  onCreatePlace,
  onViewPlaceHistory,
}) => {
  const { token } = useAuth();
  const [places, setPlaces] = useState<AdminPlaceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PlaceStatus | 'ALL'>('ALL');
  const [category, setCategory] = useState<string>('todas');
  const [localityId, setLocalityId] = useState<string>('todas');
  const [isVerified, setIsVerified] = useState<string>('ALL');

  const fetchPlaces = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'ALL') params.set('status', status);
      if (category !== 'todas') params.set('category', category);
      if (localityId !== 'todas') params.set('localityId', localityId);
      if (isVerified !== 'ALL') params.set('isVerified', isVerified);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/admin/places?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Error al consultar lugares');
      }

      const json = await res.json();
      if (json.success) {
        setPlaces(json.data);
        setTotal(json.total);
        setTotalPages(json.totalPages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar catálogo');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaces();
  }, [page, status, category, localityId, isVerified, token]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPlaces();
  };

  const handleQuickStatusChange = async (placeId: string, newStatus: PlaceStatus) => {
    try {
      const res = await fetch(`/api/admin/places/${placeId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          reason: `Cambio rápido desde la tabla administrativa a ${newStatus}`,
        }),
      });

      if (res.ok) {
        setPlaces((prev) =>
          prev.map((p) => (p.id === placeId ? { ...p, status: newStatus } : p))
        );
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Catálogo de Lugares Turísticos
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono">
              {total} lugares
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Administra estados, verificaciones oficiales, coordenadas y contenidos
          </p>
        </div>

        <button
          onClick={onCreatePlace}
          className="px-4 py-2.5 bg-[#E85B49] hover:bg-[#d64f3e] text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Lugar</span>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, dirección o etiqueta..."
              className="w-full text-xs pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Buscar
          </button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Estado
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as any);
                setPage(1);
              }}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E85B49]"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PUBLISHED">Publicados</option>
              <option value="DRAFT">Borradores</option>
              <option value="FLAGGED">Observados</option>
              <option value="ARCHIVED">Archivados</option>
            </select>
          </div>

          {/* Locality Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Localidad
            </label>
            <select
              value={localityId}
              onChange={(e) => {
                setLocalityId(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E85B49]"
            >
              <option value="todas">Todas las Localidades</option>
              {LA_LIBERTAD_LOCALITIES.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Categoría
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E85B49] capitalize"
            >
              <option value="todas">Todas las Categorías</option>
              <option value="atractivos">Atractivos</option>
              <option value="arqueologia">Arqueología</option>
              <option value="gastronomia">Gastronomía</option>
              <option value="restaurantes">Restaurantes</option>
              <option value="playas">Playas</option>
              <option value="museos">Museos</option>
              <option value="cultura">Cultura</option>
              <option value="naturaleza">Naturaleza</option>
              <option value="hoteles">Hoteles</option>
              <option value="actividades">Actividades</option>
            </select>
          </div>

          {/* Verification Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Verificación
            </label>
            <select
              value={isVerified}
              onChange={(e) => {
                setIsVerified(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#E85B49]"
            >
              <option value="ALL">Todas las Verificaciones</option>
              <option value="true">Solo Verificados</option>
              <option value="false">Sin Verificar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#E85B49]" />
            <span>Cargando lugares del catálogo...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 text-xs">
            {error}
          </div>
        ) : places.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No se encontraron lugares con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Lugar Turístico</th>
                  <th className="py-3 px-4">Categoría & Ubicación</th>
                  <th className="py-3 px-4">Calificación</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Verificación</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {places.map((place) => {
                  const coverImage =
                    place.images?.find((img) => img.isCover)?.url ||
                    place.images?.[0]?.url ||
                    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=150&q=80';

                  return (
                    <tr key={place.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name & Photo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={coverImage}
                            alt={place.name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-100 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=150&q=80';
                            }}
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate max-w-[240px]">
                              {place.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[240px]">
                              {place.address}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category & Locality */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 capitalize">
                          {place.category}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {place.localityName}
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-900">
                          ★ {place.rating?.toFixed(1) || '4.5'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {place.reviewsCount || 0} reseñas
                        </div>
                      </td>

                      {/* Status Selector */}
                      <td className="py-3 px-4">
                        <select
                          value={place.status}
                          onChange={(e) =>
                            handleQuickStatusChange(place.id, e.target.value as PlaceStatus)
                          }
                          className={`text-[11px] font-semibold px-2 py-1 rounded border focus:outline-none ${
                            place.status === 'PUBLISHED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : place.status === 'DRAFT'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : place.status === 'FLAGGED'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          <option value="PUBLISHED">PUBLICADO</option>
                          <option value="DRAFT">BORRADOR</option>
                          <option value="FLAGGED">OBSERVADO</option>
                          <option value="ARCHIVED">ARCHIVADO</option>
                        </select>
                      </td>

                      {/* Verification Badge */}
                      <td className="py-3 px-4">
                        {place.verification?.isVerified ? (
                          <div className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                            <span className="capitalize">{place.verification.verificationLevel.replace('_', ' ')}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Sin verificar</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onEditPlace(place)}
                            title="Editar lugar completo"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onViewPlaceHistory(place.id, place.name)}
                            title="Ver trazabilidad de auditoría"
                            className="p-1.5 text-slate-500 hover:text-[#E85B49] hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Página <strong className="text-slate-800 font-semibold">{page}</strong> de{' '}
            <strong className="text-slate-800 font-semibold">{totalPages}</strong> ({total} registros totales)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
