import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  MapPin,
  Image as ImageIcon,
  Clock,
  ShieldCheck,
  Info,
  Link,
  Plus,
  Trash2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AdminPlaceRecord, PlaceStatus } from '../../types/adminCatalog.ts';
import { PlaceCategory, PlaceVerification, PlaceImage, PlaceOpeningHours } from '../../types/catalog.ts';
import { LA_LIBERTAD_LOCALITIES } from '../../types/geo.ts';
import { isWithinLaLibertad } from '../../utils/geoBoundary.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface PlaceEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaceSaved: (place: AdminPlaceRecord) => void;
  initialPlace?: AdminPlaceRecord | null;
}

const CATEGORIES: { id: PlaceCategory; label: string }[] = [
  { id: 'atractivos', label: 'Atractivos Turísticos' },
  { id: 'arqueologia', label: 'Arqueología & Sitios' },
  { id: 'gastronomia', label: 'Gastronomía Tradicional' },
  { id: 'restaurantes', label: 'Restaurantes' },
  { id: 'playas', label: 'Playas & Balnearios' },
  { id: 'museos', label: 'Museos & Galerías' },
  { id: 'cultura', label: 'Cultura & Tradición' },
  { id: 'naturaleza', label: 'Naturaleza & Ecoturismo' },
  { id: 'hoteles', label: 'Hospedajes & Hoteles' },
  { id: 'actividades', label: 'Actividades & Deportes' },
];

export const PlaceEditorModal: React.FC<PlaceEditorModalProps> = ({
  isOpen,
  onClose,
  onPlaceSaved,
  initialPlace,
}) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'map' | 'contact' | 'media' | 'verification'>('general');

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('atractivos');
  const [subcategory, setSubcategory] = useState('');
  const [localityId, setLocalityId] = useState('trujillo');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(-8.1118);
  const [lng, setLng] = useState(-79.0287);
  const [shortDescription, setShortDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [priceLevel, setPriceLevel] = useState<number>(2);
  const [recommendedDurationMinutes, setRecommendedDurationMinutes] = useState(60);
  const [status, setStatus] = useState<PlaceStatus>('PUBLISHED');
  const [isVerified, setIsVerified] = useState(true);
  const [verificationLevel, setVerificationLevel] = useState<PlaceVerification['verificationLevel']>('partner_verified');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [safetyScore, setSafetyScore] = useState(85);
  const [tagsInput, setTagsInput] = useState('');
  const [images, setImages] = useState<PlaceImage[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [changeSummary, setChangeSummary] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Map state
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Load initial data
  useEffect(() => {
    if (initialPlace) {
      setName(initialPlace.name);
      setCategory(initialPlace.category);
      setSubcategory(initialPlace.subcategory || '');
      setLocalityId(initialPlace.localityId);
      setAddress(initialPlace.address);
      setLat(initialPlace.coordinates.lat);
      setLng(initialPlace.coordinates.lng);
      setShortDescription(initialPlace.shortDescription);
      setFullDescription(initialPlace.fullDescription || '');
      setPhone(initialPlace.phone || '');
      setEmail(initialPlace.email || '');
      setWebsite(initialPlace.website || '');
      setMapsUrl(initialPlace.mapsUrl || '');
      setPriceLevel(initialPlace.priceLevel || 2);
      setRecommendedDurationMinutes(initialPlace.recommendedDurationMinutes || 60);
      setStatus(initialPlace.status || 'PUBLISHED');
      setIsVerified(Boolean(initialPlace.verification?.isVerified));
      setVerificationLevel(initialPlace.verification?.verificationLevel || 'partner_verified');
      setVerificationNotes(initialPlace.verification?.notes || '');
      setSafetyScore(initialPlace.safetyScore ?? 85);
      setTagsInput(Array.isArray(initialPlace.tags) ? initialPlace.tags.join(', ') : '');
      setImages(initialPlace.images || []);
      setChangeSummary('');
    } else {
      setName('');
      setCategory('atractivos');
      setSubcategory('');
      setLocalityId('trujillo');
      setAddress('Centro Histórico, Trujillo');
      setLat(-8.1118);
      setLng(-79.0287);
      setShortDescription('');
      setFullDescription('');
      setPhone('');
      setEmail('');
      setWebsite('');
      setMapsUrl('');
      setPriceLevel(2);
      setRecommendedDurationMinutes(60);
      setStatus('PUBLISHED');
      setIsVerified(true);
      setVerificationLevel('partner_verified');
      setVerificationNotes('Verificado por administración RIYMO');
      setSafetyScore(85);
      setTagsInput('turismo, la-libertad');
      setImages([
        {
          id: `img_${Date.now()}`,
          url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
          caption: 'Foto principal',
          isCover: true,
        },
      ]);
      setChangeSummary('Creación inicial');
    }
    setError(null);
  }, [initialPlace, isOpen]);

  // Map Initialization on Tab Change or Coordinate Change
  useEffect(() => {
    if (activeTab !== 'map' || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [lng, lat],
        zoom: 14,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

      const marker = new maplibregl.Marker({
        color: '#E85B49',
        draggable: true,
      })
        .setLngLat([lng, lat])
        .addTo(map);

      marker.on('dragend', () => {
        const coords = marker.getLngLat();
        setLat(Math.round(coords.lat * 100000) / 100000);
        setLng(Math.round(coords.lng * 100000) / 100000);
      });

      map.on('click', (e) => {
        marker.setLngLat(e.lngLat);
        setLat(Math.round(e.lngLat.lat * 100000) / 100000);
        setLng(Math.round(e.lngLat.lng * 100000) / 100000);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    } else {
      mapInstanceRef.current.resize();
      mapInstanceRef.current.setCenter([lng, lat]);
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      }
    }
  }, [activeTab, lat, lng]);

  // Clean up map on close
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    setImages((prev) => [
      ...prev,
      {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        url: newImageUrl.trim(),
        caption: name || 'Imagen de establecimiento',
        isCover: prev.length === 0,
      },
    ]);
    setNewImageUrl('');
  };

  const handleRemoveImage = (imgId: string) => {
    setImages((prev) => {
      const remaining = prev.filter((img) => img.id !== imgId);
      if (remaining.length > 0 && !remaining.some((img) => img.isCover)) {
        remaining[0].isCover = true;
      }
      return remaining;
    });
  };

  const handleSetCover = (imgId: string) => {
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        isCover: img.id === imgId,
      }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('El nombre del lugar es obligatorio.');
      return;
    }
    if (!address.trim()) {
      setError('La dirección física es obligatoria.');
      return;
    }
    if (!shortDescription.trim()) {
      setError('La descripción breve es obligatoria.');
      return;
    }

    if (!isWithinLaLibertad({ lat, lng })) {
      setError('Las coordenadas deben estar ubicadas dentro del departamento de La Libertad, Perú.');
      return;
    }

    const selectedLocalityObj = LA_LIBERTAD_LOCALITIES.find((l) => l.id === localityId);
    const localityName = selectedLocalityObj ? selectedLocalityObj.name : 'La Libertad';

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const payload = {
      name: name.trim(),
      category,
      subcategory: subcategory.trim() || undefined,
      localityId,
      localityName,
      address: address.trim(),
      coordinates: { lat, lng },
      shortDescription: shortDescription.trim(),
      fullDescription: fullDescription.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      website: website.trim() || undefined,
      mapsUrl: mapsUrl.trim() || undefined,
      priceLevel: priceLevel as 1 | 2 | 3 | 4,
      recommendedDurationMinutes,
      status,
      verification: {
        isVerified,
        verificationLevel,
        notes: verificationNotes.trim() || undefined,
      },
      safetyScore,
      tags: tags.length > 0 ? tags : ['turismo', 'la-libertad'],
      images: images.length > 0 ? images : [
        {
          id: `img_${Date.now()}`,
          url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
          caption: name,
          isCover: true,
        },
      ],
      changeSummary: changeSummary.trim() || (initialPlace ? 'Actualización de datos' : 'Creación inicial'),
    };

    setIsSaving(true);

    try {
      const url = initialPlace ? `/api/admin/places/${initialPlace.id}` : '/api/admin/places';
      const method = initialPlace ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al guardar el lugar');
      }

      onPlaceSaved(json.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar cambios');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {initialPlace ? `Editar: ${initialPlace.name}` : 'Registrar Nuevo Lugar Turístico'}
            </h2>
            <p className="text-xs text-slate-500">
              {initialPlace ? `ID: ${initialPlace.id} • Slug: ${initialPlace.slug}` : 'Ingresa los datos del nuevo atractivo o establecimiento'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white shrink-0 overflow-x-auto">
          {[
            { id: 'general', label: 'General & Textos', icon: Info },
            { id: 'map', label: 'Ubicación GPS & Mapa', icon: MapPin },
            { id: 'contact', label: 'Contacto & Metadatos', icon: Link },
            { id: 'media', label: 'Imágenes', icon: ImageIcon },
            { id: 'verification', label: 'Estado & Verificación', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-[#E85B49] text-[#E85B49]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombre Oficial *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Huaca de la Luna"
                    required
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Categoría Turística *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PlaceCategory)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white capitalize"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subcategoría
                  </label>
                  <input
                    type="text"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    placeholder="Ej. Sitio Arqueológico Moche"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Localidad (La Libertad) *
                  </label>
                  <select
                    value={localityId}
                    onChange={(e) => setLocalityId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white"
                  >
                    {LA_LIBERTAD_LOCALITIES.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dirección Física *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej. Campiña de Moche, Trujillo"
                  required
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descripción Corta (Resumen para tarjetas) *
                </label>
                <textarea
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  rows={2}
                  placeholder="Descripción concisa visible en el planificador..."
                  required
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descripción Completa Detallada
                </label>
                <textarea
                  value={fullDescription}
                  onChange={(e) => setFullDescription(e.target.value)}
                  rows={4}
                  placeholder="Historia, recomendaciones, qué ver, contexto cultural..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Etiquetas (separadas por coma)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="arqueologia, moche, murales, historia"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] focus:bg-white font-mono"
                />
              </div>
            </div>
          )}

          {/* TAB 2: MAP & GPS */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#E85B49] shrink-0" />
                <span>
                  Haz clic en el mapa o arrastra el marcador rojo para fijar las coordenadas exactas dentro de La Libertad.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Latitud
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-[#E85B49]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Longitud
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-[#E85B49]"
                  />
                </div>
              </div>

              {/* Map Container */}
              <div
                ref={mapContainerRef}
                className="w-full h-80 rounded-xl border border-slate-300 overflow-hidden shadow-inner"
              />
            </div>
          )}

          {/* TAB 3: CONTACT & DETAILS */}
          {activeTab === 'contact' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+51 44 282121"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contacto@huacasdemoche.pe"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sitio Web Oficial
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://huacasdemoche.pe"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nivel de Precios
                  </label>
                  <select
                    value={priceLevel}
                    onChange={(e) => setPriceLevel(Number(e.target.value))}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                  >
                    <option value={1}>$ Económico (Gratis o muy bajo)</option>
                    <option value={2}>$$ Moderado (Estándar)</option>
                    <option value={3}>$$$ Alto (Experiencia premium)</option>
                    <option value={4}>$$$$ Exclusivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tiempo de Visita Recomendado (minutos)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={recommendedDurationMinutes}
                    onChange={(e) => setRecommendedDurationMinutes(Number(e.target.value) || 60)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Índice de Seguridad Territorial (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={safetyScore}
                    onChange={(e) => setSafetyScore(Number(e.target.value) || 85)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Enlace de Google Maps / Ficha
                </label>
                <input
                  type="url"
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  placeholder="https://maps.google.com/?cid=..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                />
              </div>
            </div>
          )}

          {/* TAB 4: MEDIA & IMAGES */}
          {activeTab === 'media' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... o enlace de fotografía"
                  className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                />
                <button
                  type="button"
                  onClick={handleAddImage}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Foto</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={`relative rounded-lg border overflow-hidden group bg-slate-100 ${
                      img.isCover ? 'ring-2 ring-[#E85B49] border-transparent' : 'border-slate-200'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.caption || 'Foto'}
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80';
                      }}
                    />

                    {img.isCover && (
                      <span className="absolute top-2 left-2 bg-[#E85B49] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                        Portada
                      </span>
                    )}

                    <div className="p-2 bg-white flex items-center justify-between text-xs">
                      {!img.isCover && (
                        <button
                          type="button"
                          onClick={() => handleSetCover(img.id)}
                          className="text-[11px] text-slate-600 hover:text-[#E85B49] cursor-pointer"
                        >
                          Hacer portada
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(img.id)}
                        className="text-red-500 hover:text-red-700 p-1 ml-auto cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: VERIFICATION & STATUS */}
          {activeTab === 'verification' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estado en el Catálogo *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as PlaceStatus)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] font-medium"
                  >
                    <option value="PUBLISHED">PUBLICADO (Visible en planificador público)</option>
                    <option value="DRAFT">BORRADOR (Oculto, en preparación)</option>
                    <option value="FLAGGED">OBSERVADO (Requiere corrección de datos)</option>
                    <option value="ARCHIVED">ARCHIVADO (Cerrado o descontinuado)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nivel de Verificación
                  </label>
                  <select
                    value={verificationLevel}
                    onChange={(e) => setVerificationLevel(e.target.value as any)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                  >
                    <option value="official_mincetur">Oficial MINCETUR / Directorio Regional</option>
                    <option value="partner_verified">Verificado por Administrador RIYMO</option>
                    <option value="community">Aportado por Comunidad / Creadores</option>
                    <option value="unverified">Sin Verificar</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkVerified"
                  checked={isVerified}
                  onChange={(e) => setIsVerified(e.target.checked)}
                  className="w-4 h-4 text-[#E85B49] rounded border-slate-300 focus:ring-[#E85B49]"
                />
                <label htmlFor="chkVerified" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Marcar como lugar verificado y confiable
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notas de Verificación o Motivo de Estado
                </label>
                <textarea
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  rows={2}
                  placeholder="Detalles sobre resolución, número de ficha MINCETUR, o motivo del estado actual..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                />
              </div>

              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resumen de Cambio (Para el registro inmutable de auditoría)
                </label>
                <input
                  type="text"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="Ej. Actualización de horarios y fotografías de temporada"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                />
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-[#E85B49] hover:bg-[#d64f3e] disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Guardando en catálogo...' : 'Guardar y Publicar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
