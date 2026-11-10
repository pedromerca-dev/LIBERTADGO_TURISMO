import React, { useState, useEffect } from 'react';
import { Tag, CheckCircle2, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface CategoryStat {
  category: string;
  count: number;
  published: number;
}

interface CategoriesViewProps {
  onFilterByCategory: (category: string) => void;
}

const CATEGORY_METADATA: Record<string, { label: string; desc: string; color: string }> = {
  restaurantes: {
    label: 'Restaurantes & Pollerías',
    desc: 'Establecimientos gastronómicos, comida criolla, marina y contemporánea.',
    color: 'bg-orange-50 border-orange-200 text-orange-900',
  },
  gastronomia: {
    label: 'Gastronomía Tradicional',
    desc: 'Cevicherías, shámbar, sopa teóloga y dulces tradicionales trujillanos.',
    color: 'bg-amber-50 border-amber-200 text-amber-900',
  },
  atractivos: {
    label: 'Atractivos Turísticos',
    desc: 'Plazas mayores, casonas virreinales, templos y monumentos históricos.',
    color: 'bg-rose-50 border-rose-200 text-rose-900',
  },
  arqueologia: {
    label: 'Sitios Arqueológicos',
    desc: 'Chan Chan, Huacas de Moche, Complejo El Brujo y ciudadelas preincas.',
    color: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  },
  playas: {
    label: 'Playas & Balnearios',
    desc: 'Huanchaco, Puerto Malabrigo (Chicama), Pacasmayo y Salaverry.',
    color: 'bg-cyan-50 border-cyan-200 text-cyan-900',
  },
  museos: {
    label: 'Museos & Galerías',
    desc: 'Museo de Sitio Chan Chan, Museo Huacas de Moche, Casa de la Emancipación.',
    color: 'bg-indigo-50 border-indigo-200 text-indigo-900',
  },
  cultura: {
    label: 'Cultura & Tradición',
    desc: 'Marinera norteña, talleres artesanales, caballos de paso y festividades.',
    color: 'bg-purple-50 border-purple-200 text-purple-900',
  },
  naturaleza: {
    label: 'Naturaleza & Paisajes',
    desc: 'Humedales de Huanchaco (totorales), valles andinos y campiñas.',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  },
  hoteles: {
    label: 'Hospedajes & Hoteles',
    desc: 'Hoteles ejecutivos, casonas boutique, resorts frente al mar y hostales.',
    color: 'bg-blue-50 border-blue-200 text-blue-900',
  },
  actividades: {
    label: 'Actividades & Aventura',
    desc: 'Surf en olas izquierdas, paseos en caballitos de totora y sandboard.',
    color: 'bg-teal-50 border-teal-200 text-teal-900',
  },
};

export const CategoriesView: React.FC<CategoriesViewProps> = ({ onFilterByCategory }) => {
  const { token } = useAuth();
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/categories', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setCategories(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-[#E85B49]" />
        <span>Cargando categorías turísticas...</span>
      </div>
    );
  }

  const totalPlaces = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Categorías del Catálogo Turístico
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Estructura taxonómica para clasificación y filtros temáticos de La Libertad
          </p>
        </div>
        <div className="text-xs text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs font-medium">
          {categories.length} categorías oficiales • {totalPlaces} lugares clasificados
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const meta = CATEGORY_METADATA[cat.category] || {
            label: cat.category.toUpperCase(),
            desc: 'Lugares turísticos de esta categoría regional.',
            color: 'bg-slate-50 border-slate-200 text-slate-800',
          };
          const percentage = totalPlaces > 0 ? Math.round((cat.count / totalPlaces) * 100) : 0;

          return (
            <div
              key={cat.category}
              className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {cat.count} lugares
                  </span>
                </div>

                <p className="text-xs text-slate-600 mb-4">{meta.desc}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  <strong className="text-slate-800">{cat.published}</strong> publicados ({percentage}%)
                </div>

                <button
                  onClick={() => onFilterByCategory(cat.category)}
                  className="text-xs text-[#E85B49] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Explorar</span>
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
