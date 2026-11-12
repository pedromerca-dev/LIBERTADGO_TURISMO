import React from 'react';
import { X, Layers, Database, Compass, MapPin, Cpu, CheckCircle2, Shield, Calendar, ArrowRight } from 'lucide-react';
import { LA_LIBERTAD_LOCALITIES, LA_LIBERTAD_BOUNDS } from '../types/geo.ts';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="arch-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E05A47] text-white flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 id="arch-modal-title" className="text-lg font-bold font-display text-slate-900 leading-tight">
                Arquitectura Técnica & Plan Maestro · RIYMO
              </h2>
              <p className="text-xs text-slate-500">
                MVP Funcional enfocado exclusivamente en la región La Libertad, Perú
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal de arquitectura"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-sm">
          {/* Section 1: Restricción Geográfica */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider mb-2">
              <Shield className="w-4 h-4 text-[#E05A47]" />
              <span>Restricción Geográfica Inviolable (La Libertad, Perú)</span>
            </div>
            <p className="text-xs text-amber-950 leading-relaxed">
              El backend implementa un validador de límites geoespaciales (Bounding Box: lat [<code>{LA_LIBERTAD_BOUNDS.minLat}</code> a <code>{LA_LIBERTAD_BOUNDS.maxLat}</code>], lng [<code>{LA_LIBERTAD_BOUNDS.minLng}</code> a <code>{LA_LIBERTAD_BOUNDS.maxLng}</code>]) y catálogo cerrado de 10 localidades autorizadas. No se devuelven ni aceptan establecimientos de Lima, Cusco ni otras regiones.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mt-3">
              {LA_LIBERTAD_LOCALITIES.map((loc) => (
                <div key={loc.id} className="bg-white/80 border border-amber-200/60 rounded px-2 py-1 text-[11px] font-medium text-slate-800">
                  {loc.isPriority ? '★ ' : ''}{loc.name}
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Fuentes de Datos y Estrategia Turística */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Estrategia de Fuentes de Datos (La Libertad)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="font-bold text-[#17243A] block mb-0.5">1. MINCETUR & Directorio Nacional</span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Inventario Nacional de Recursos Turísticos y Directorio de Prestadores Calificados de La Libertad. Fichas oficiales con códigos de registro.
                </p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="font-bold text-[#17243A] block mb-0.5">2. OpenStreetMap & Catálogo Propio</span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Geodatos abiertos, polígonos, calles y coordenadas validadas dentro de la región La Libertad con deduplicación por ID/slug.
                </p>
              </div>
            </div>
            <div className="mt-3 p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900">
              <strong>Estado de Google Places API:</strong> Identificado como complemento futuro. No está configurado en este entorno por requerir provisión de proyecto en Google Cloud con facturación activa y variable de entorno <code>GOOGLE_PLACES_API_KEY</code>. La aplicación opera con 100% de autonomía gracias al catálogo MINCETUR/OSM verificado.
            </div>
          </div>

          {/* Section 3: Arquitectura del Sistema (Clean Architecture) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase mb-1.5">
                <Compass className="w-4 h-4 text-[#E05A47]" />
                <span>Frontend (React 19)</span>
              </div>
              <ul className="text-xs space-y-1 text-slate-600">
                <li>• Workspace coordinado de 3 paneles</li>
                <li>• MapLibre GL JS + OpenStreetMap</li>
                <li>• Mapa contraíble con ResizeObserver</li>
                <li>• Navegación independiente por sección</li>
              </ul>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase mb-1.5">
                <Database className="w-4 h-4 text-sky-600" />
                <span>Backend & API (Node/Express)</span>
              </div>
              <ul className="text-xs space-y-1 text-slate-600">
                <li>• Validación estricta con Zod</li>
                <li>• Repositorios & Controladores desacoplados</li>
                <li>• Búsqueda por texto y filtros por categoría</li>
                <li>• Endpoints REST con paginación</li>
              </ul>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase mb-1.5">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span>Consistencia Temporal (UTC)</span>
              </div>
              <ul className="text-xs space-y-1 text-slate-600">
                <li>• Aritmética de fechas en UTC estricto</li>
                <li>• Cero desfases por zona horaria</li>
                <li>• Cálculo sincronizado de días y noches</li>
                <li>• Desglose coherente en todas las vistas</li>
              </ul>
            </div>
          </div>

          {/* Section 3: Roadmap de Etapas */}
          <div>
            <h3 className="font-bold font-display text-slate-900 text-sm mb-3">
              Plan de Ejecución por Etapas
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-emerald-950">
                    ETAPA 1 (Actual): Requerimientos, Arquitectura, Identidad Visual y Creación de Viaje
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    Modelos de dominio, validaciones Zod, cálculo de fechas y noches, catálogo de 10 localidades liberteñas y flujo inicial completo.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="w-4 h-4 rounded-full border border-slate-400 text-[10px] flex items-center justify-center text-slate-600 font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    ETAPA 2: Workspace de Tres Paneles (Itinerario, Mapa MapLibre, Descubrimiento)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Paneles sincronizados, marcadores numerados en mapa de La Libertad y exploración por categorías.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="w-4 h-4 rounded-full border border-slate-400 text-[10px] flex items-center justify-center text-slate-600 font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    ETAPA 3: Firebase Auth & Firestore Persistence
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Reglas de seguridad de Firestore, sincronización en tiempo real y cuentas de usuario.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="w-4 h-4 rounded-full border border-slate-400 text-[10px] flex items-center justify-center text-slate-600 font-bold shrink-0 mt-0.5">
                  4-6
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    ETAPAS 4 a 6: Ingesta MINCETUR/OSM, Sincronización Geográfica & Asistente Gemini
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Fichas detalladas con horarios reales verificados e itinerarios inteligentes asistidos por IA.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Entendido, explorar la aplicación
          </button>
        </div>
      </div>
    </div>
  );
};
