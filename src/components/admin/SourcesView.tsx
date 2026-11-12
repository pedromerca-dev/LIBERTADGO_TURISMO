import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, ExternalLink, RefreshCw, CheckCircle, FileCode } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface SourceStat {
  sourceId: string;
  count: number;
}

const SOURCES_INFO: Record<string, { title: string; provider: string; license: string; desc: string; url?: string }> = {
  mincetur_inventory: {
    title: 'Inventario Nacional de Recursos Turísticos',
    provider: 'MINCETUR / DIRCETUR La Libertad',
    license: 'Datos Abiertos del Gobierno Peruano (ODbL)',
    desc: 'Fichas oficiales categorizadas y jerarquizadas de atractivos del patrimonio nacional.',
    url: 'https://consultasenlinea.mincetur.gob.pe/inventarioturistico/',
  },
  mincetur_directory: {
    title: 'Directorio Nacional de Prestadores de Servicios Turísticos',
    provider: 'MINCETUR',
    license: 'Registro Público Oficial',
    desc: 'Hospedajes, restaurantes, agencias de viaje y guías turísticos acreditados.',
    url: 'https://consultasenlinea.mincetur.gob.pe/directorioprestadores/',
  },
  openstreetmap: {
    title: 'OpenStreetMap Contributors',
    provider: 'Comunidad Abierta OpenStreetMap (OSM)',
    license: 'Open Database License (ODbL)',
    desc: 'Geometrías viales, coordenadas geográficas precisas y puntos de interés urbano en La Libertad.',
    url: 'https://www.openstreetmap.org',
  },
  business_registry: {
    title: 'Directorio Empresarial Regional La Libertad',
    provider: 'Cámara de Comercio de La Libertad / Municipalidad Provincial de Trujillo',
    license: 'Uso Institucional',
    desc: 'Verificación de locales gastronómicos y culturales tradicionales de la región.',
  },
  panel_admin_libertadgo: {
    title: 'Carga & Verificación Panel Administrador',
    provider: 'Equipo Editorial RIYMO',
    license: 'Propiedad Editorial RIYMO',
    desc: 'Lugares incorporados, editados o validados manualmente por los administradores de la plataforma.',
  },
};

export const SourcesView: React.FC = () => {
  const { token } = useAuth();
  const [sources, setSources] = useState<SourceStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/sources', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setSources(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-[#E85B49]" />
        <span>Cargando fuentes de información y trazabilidad...</span>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Fuentes de Información y Trazabilidad
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Procedencia oficial y licencias de datos del catálogo turístico de La Libertad
        </p>
      </div>

      {/* Policy banner */}
      <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#E85B49] shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-bold text-white">Política de Calidad y Cero Alucinación</div>
          <p className="text-slate-300">
            Cada establecimiento registrado en RIYMO cuenta con un identificador de origen verificable,
            ya sea MINCETUR, OpenStreetMap o el directorio verificado por administradores. No se admiten lugares con datos ficticios o ubicaciones simuladas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map((src) => {
          const info = SOURCES_INFO[src.sourceId] || {
            title: src.sourceId,
            provider: 'Fuente Registrada',
            license: 'Estándar',
            desc: 'Fuente de datos integrada al catálogo turístico regional.',
          };

          return (
            <div
              key={src.sourceId}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{info.title}</h3>
                    <p className="text-[11px] text-[#E85B49] font-medium">{info.provider}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-bold font-mono text-slate-900">
                    {src.count}
                  </span>
                  <div className="text-[10px] text-slate-400">referencias</div>
                </div>
              </div>

              <p className="text-xs text-slate-600">{info.desc}</p>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <div className="text-slate-500 font-mono text-[10px]">
                  Licencia: <strong>{info.license}</strong>
                </div>

                {info.url && (
                  <a
                    href={info.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E85B49] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <span>Ver portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
