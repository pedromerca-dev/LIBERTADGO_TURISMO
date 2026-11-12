import React, { useState, useEffect, useRef } from 'react';
import { X, UserCheck, Check, AlertCircle, Sparkles, Users, Upload, Trash2, Camera, Loader2, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { CreatorProfile, VideoPlatform } from '../../types/creators.ts';

interface CreatorEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatorSaved: () => void;
  initialCreator?: CreatorProfile | null;
  users?: { id: string; email: string; name: string }[];
}

const DEFAULT_USERS: { id: string; email: string; name: string }[] = [];

export const CreatorEditorModal: React.FC<CreatorEditorModalProps> = ({
  isOpen,
  onClose,
  onCreatorSaved,
  initialCreator,
  users = DEFAULT_USERS,
}) => {
  const { token, user: currentUser } = useAuth();
  const isEditing = Boolean(initialCreator);

  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [primaryPlatform, setPrimaryPlatform] = useState<VideoPlatform>('tiktok');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [tiktokFollowers, setTiktokFollowers] = useState('');
  const [instagramFollowers, setInstagramFollowers] = useState('');
  const [youtubeSubscribers, setYoutubeSubscribers] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialCreator) {
      setHandle(initialCreator.handle || '');
      setDisplayName(initialCreator.displayName || '');
      setBio(initialCreator.bio || '');
      setAvatarUrl(initialCreator.avatarUrl || '');
      setPreviewUrl(initialCreator.avatarUrl || null);
      setPrimaryPlatform(initialCreator.primaryPlatform || 'tiktok');
      setTiktokUrl(initialCreator.tiktokUrl || '');
      setInstagramUrl(initialCreator.instagramUrl || '');
      setYoutubeUrl(initialCreator.youtubeUrl || '');
      setTiktokFollowers(initialCreator.tiktokFollowers != null ? String(initialCreator.tiktokFollowers) : '');
      setInstagramFollowers(initialCreator.instagramFollowers != null ? String(initialCreator.instagramFollowers) : '');
      setYoutubeSubscribers(initialCreator.youtubeSubscribers != null ? String(initialCreator.youtubeSubscribers) : '');
      setIsPublic(initialCreator.isPublic ?? true);
      setIsVerified(Boolean(initialCreator.isVerified));
      setSelectedUserId(initialCreator.userId || '');
    } else {
      setHandle('');
      setDisplayName('');
      setBio('');
      setAvatarUrl('');
      setPreviewUrl(null);
      setPrimaryPlatform('tiktok');
      setTiktokUrl('');
      setInstagramUrl('');
      setYoutubeUrl('');
      setTiktokFollowers('');
      setInstagramFollowers('');
      setYoutubeSubscribers('');
      setIsPublic(true);
      setIsVerified(false);
      setSelectedUserId(users[0]?.id || currentUser?.id || '');
    }
    setUploadError(null);
    setErrorMessage(null);
  }, [isOpen, initialCreator, currentUser?.id, users]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // 1. Format validation: JPG, JPEG, PNG, WebP
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const validExts = /\.(jpe?g|png|webp)$/i;
    const isMimeValid = validMimes.includes(file.type.toLowerCase());
    const isExtValid = validExts.test(file.name);

    if (!isMimeValid && !isExtValid) {
      setUploadError('Formato no permitido. Solo se aceptan imágenes en formato JPG, JPEG, PNG o WebP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Size validation: max 5 MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError(
        `El archivo (${(file.size / (1024 * 1024)).toFixed(2)} MB) supera el tamaño máximo permitido de 5 MB.`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Preserve previous photo in case upload fails
    const previousAvatar = avatarUrl;
    setIsUploading(true);

    try {
      const res = await fetch('/api/admin/uploads/avatar', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'image/jpeg',
          'X-Filename': encodeURIComponent(file.name),
          Authorization: `Bearer ${token}`,
        },
        body: file,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al cargar la imagen');
      }

      const uploadedUrl = json.data?.url;
      if (!uploadedUrl) {
        throw new Error('El servidor no retornó una URL válida');
      }

      setAvatarUrl(uploadedUrl);
      setPreviewUrl(uploadedUrl);
      setUploadError(null);
    } catch (err) {
      // Revert to previous avatar so it doesn't disappear on failure
      setAvatarUrl(previousAvatar);
      setPreviewUrl(previousAvatar || null);
      setUploadError(err instanceof Error ? err.message : 'Error al cargar la fotografía');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    setPreviewUrl(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanHandle = handle.trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_]{3,30}$/.test(cleanHandle)) {
      setErrorMessage('El handle debe tener entre 3 y 30 caracteres alfanuméricos o guiones bajos');
      return;
    }

    if (displayName.trim().length < 2) {
      setErrorMessage('El nombre visible debe contener al menos 2 caracteres');
      return;
    }

    // Validate integer >= 0 for audience metrics
    let parsedTiktok: number | null = null;
    if (tiktokFollowers.trim().length > 0) {
      if (!/^\d+$/.test(tiktokFollowers.trim())) {
        setErrorMessage('Los seguidores de TikTok deben ser un número entero mayor o igual a 0');
        return;
      }
      parsedTiktok = parseInt(tiktokFollowers.trim(), 10);
    }

    let parsedInstagram: number | null = null;
    if (instagramFollowers.trim().length > 0) {
      if (!/^\d+$/.test(instagramFollowers.trim())) {
        setErrorMessage('Los seguidores de Instagram deben ser un número entero mayor o igual a 0');
        return;
      }
      parsedInstagram = parseInt(instagramFollowers.trim(), 10);
    }

    let parsedYoutube: number | null = null;
    if (youtubeSubscribers.trim().length > 0) {
      if (!/^\d+$/.test(youtubeSubscribers.trim())) {
        setErrorMessage('Los suscriptores de YouTube deben ser un número entero mayor o igual a 0');
        return;
      }
      parsedYoutube = parseInt(youtubeSubscribers.trim(), 10);
    }

    setIsSubmitting(true);

    try {
      const payload = {
        userId: selectedUserId || currentUser?.id,
        handle: cleanHandle,
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        primaryPlatform,
        tiktokUrl: tiktokUrl.trim() || null,
        instagramUrl: instagramUrl.trim() || null,
        youtubeUrl: youtubeUrl.trim() || null,
        tiktokFollowers: parsedTiktok,
        instagramFollowers: parsedInstagram,
        youtubeSubscribers: parsedYoutube,
        audienceUpdatedAt:
          parsedTiktok !== null || parsedInstagram !== null || parsedYoutube !== null
            ? new Date().toISOString()
            : null,
        isPublic,
        isVerified,
      };

      const res = await fetch('/api/admin/creators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al guardar perfil de creador');
      }

      onCreatorSaved();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al registrar creador');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E85B49] flex items-center justify-center text-white">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">
                {isEditing ? 'Editar Perfil de Creador' : 'Registrar Perfil de Creador'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Directorio y autoría de creadores turísticos de La Libertad
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="m-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">No se pudo guardar el creador</p>
              <p className="mt-0.5 text-rose-700">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* User Association (Optional) */}
          {users.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Asociar a Usuario del Sistema (Opcional)
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
              >
                <option value="">Cuenta de Administrador Actual</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Handle & Display Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Identificador (@handle) *
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">@</span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="trujillofoodie"
                  required
                  className="w-full text-xs py-2 pr-2 pl-7 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Nombre Visible / Marca *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Trujillo Gastronómico"
                required
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
              />
            </div>
          </div>

          {/* Primary Platform */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">
              Plataforma Principal *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['tiktok', 'instagram', 'youtube'] as VideoPlatform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrimaryPlatform(p)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border text-center capitalize transition-colors ${
                    primaryPlatform === p
                      ? 'border-[#E85B49] bg-rose-50/50 text-[#E85B49]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">
              Biografía / Reseña corta
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Creador local apasionado por el turismo cultural y la gastronomía liberteña..."
              rows={2}
              maxLength={300}
              className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
            />
          </div>

          {/* Fotografía de perfil del creador */}
          <div className="space-y-3 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#E85B49]" />
                <label className="text-xs font-bold text-slate-900">
                  Fotografía de perfil del creador
                </label>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                JPG, PNG, WebP &bull; Máx. 5 MB
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Sube la foto de perfil descargada de TikTok, Instagram o YouTube para guardarla permanentemente en Wayra.
            </p>

            {/* Error banner */}
            {uploadError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-700 text-xs animate-fadeIn">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
                <div className="flex-1 text-[11px] leading-tight font-medium">
                  {uploadError}
                </div>
              </div>
            )}

            {/* Preview and Controls */}
            <div className="flex items-center gap-4 pt-1">
              {/* Avatar Preview */}
              <div className="relative w-16 h-16 rounded-full border-2 border-slate-200 overflow-hidden bg-white shadow-sm shrink-0 flex items-center justify-center">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={displayName || handle || 'Foto de perfil'}
                    className="w-full h-full object-cover"
                    onError={() => {
                      setPreviewUrl(null);
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-sm">
                    {displayName ? displayName.slice(0, 2).toUpperCase() : (handle ? handle.slice(0, 2).toUpperCase() : <Camera className="w-5 h-5 text-slate-300" />)}
                  </div>
                )}

                {/* Loading overlay */}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isUploading}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-3 py-1.5 bg-[#E85B49] text-white rounded-lg text-xs font-semibold hover:bg-[#d64a38] transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Subiendo...</span>
                      </>
                    ) : previewUrl ? (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Reemplazar imagen</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir fotografía</span>
                      </>
                    )}
                  </button>

                  {previewUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={isUploading}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar imagen</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowManualUrl(!showManualUrl)}
                    className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium transition-colors"
                  >
                    <LinkIcon className="w-3 h-3" />
                    <span>{showManualUrl ? 'Ocultar URL manual' : 'Especificar URL manualmente'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Manual URL input fallback if needed */}
            {showManualUrl && (
              <div className="pt-2 border-t border-slate-200/80 space-y-1 animate-fadeIn">
                <label className="block text-[11px] font-medium text-slate-600">
                  Ruta o URL del avatar
                </label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAvatarUrl(val);
                    setPreviewUrl(val || null);
                  }}
                  placeholder="/uploads/avatars/... o https://..."
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] font-mono text-[11px]"
                />
              </div>
            )}
          </div>

          {/* Social Links */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-800">Enlaces de Redes Sociales</label>
            <div className="space-y-2">
              <input
                type="url"
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="Perfil de TikTok (https://www.tiktok.com/@...)"
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
              />
              <input
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="Perfil de Instagram (https://instagram.com/...)"
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
              />
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="Canal de YouTube (https://youtube.com/@...)"
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
              />
            </div>
          </div>

          {/* Audience Section (Followers & Subscribers) */}
          <div className="space-y-2.5 pt-3 border-t border-slate-200 bg-slate-50/70 p-3 rounded-xl border">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#E85B49]" />
              <label className="text-xs font-bold text-slate-900">
                Audiencia en Redes Sociales
              </label>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Datos declarados por el creador o administrador. Ingrese valores enteros positivos o deje vacío si no se conoce.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Seguidores TikTok
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={tiktokFollowers}
                  onChange={(e) => setTiktokFollowers(e.target.value)}
                  placeholder="ej. 150000"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                />
                {tiktokFollowers && /^\d+$/.test(tiktokFollowers) && (
                  <span className="text-[10px] text-slate-500 block">
                    {parseInt(tiktokFollowers, 10).toLocaleString('es-PE')} seguidores
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Seguidores Instagram
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={instagramFollowers}
                  onChange={(e) => setInstagramFollowers(e.target.value)}
                  placeholder="ej. 45000"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                />
                {instagramFollowers && /^\d+$/.test(instagramFollowers) && (
                  <span className="text-[10px] text-slate-500 block">
                    {parseInt(instagramFollowers, 10).toLocaleString('es-PE')} seguidores
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Suscriptores YouTube
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={youtubeSubscribers}
                  onChange={(e) => setYoutubeSubscribers(e.target.value)}
                  placeholder="ej. 20000"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                />
                {youtubeSubscribers && /^\d+$/.test(youtubeSubscribers) && (
                  <span className="text-[10px] text-slate-500 block">
                    {parseInt(youtubeSubscribers, 10).toLocaleString('es-PE')} suscriptores
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Checkboxes: Verified & Public */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={isVerified}
                onChange={(e) => setIsVerified(e.target.checked)}
                className="rounded text-[#E85B49] focus:ring-[#E85B49]"
              />
              <span className="flex items-center gap-1 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Creador Verificado Oficial
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded text-[#E85B49] focus:ring-[#E85B49]"
              />
              <span className="font-medium">Perfil público en directorio</span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-[#E85B49] hover:bg-[#d64f3e] disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Guardar Cambios' : 'Registrar Creador'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
