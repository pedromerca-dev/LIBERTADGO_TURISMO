import React, { useState, useEffect } from 'react';
import { X, UserCheck, Check, AlertCircle, Sparkles } from 'lucide-react';
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
  const [primaryPlatform, setPrimaryPlatform] = useState<VideoPlatform>('tiktok');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
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
      setPrimaryPlatform(initialCreator.primaryPlatform || 'tiktok');
      setTiktokUrl(initialCreator.tiktokUrl || '');
      setInstagramUrl(initialCreator.instagramUrl || '');
      setYoutubeUrl(initialCreator.youtubeUrl || '');
      setIsPublic(initialCreator.isPublic ?? true);
      setIsVerified(Boolean(initialCreator.isVerified));
      setSelectedUserId(initialCreator.userId || '');
    } else {
      setHandle('');
      setDisplayName('');
      setBio('');
      setAvatarUrl('');
      setPrimaryPlatform('tiktok');
      setTiktokUrl('');
      setInstagramUrl('');
      setYoutubeUrl('');
      setIsPublic(true);
      setIsVerified(false);
      setSelectedUserId(users[0]?.id || currentUser?.id || '');
    }
    setErrorMessage(null);
  }, [isOpen, initialCreator]);

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
                Directorio oficial de creadores de contenido de La Libertad
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Handle & Display Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Handle único (@usuario) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                  @
                </span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  placeholder="huanchaco_surf"
                  className="w-full text-xs pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49] font-mono"
                  required
                  maxLength={30}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Nombre para Mostrar *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Huanchaco Surf & Food"
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
                required
                maxLength={60}
              />
            </div>
          </div>

          {/* Primary Platform & Verification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Plataforma Principal *
              </label>
              <select
                value={primaryPlatform}
                onChange={(e) => setPrimaryPlatform(e.target.value as VideoPlatform)}
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
              >
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Usuario del Sistema
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
              >
                {users.length > 0 ? (
                  users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))
                ) : (
                  <option value={currentUser?.id || ''}>
                    {currentUser?.name || 'Administrador actual'} ({currentUser?.email})
                  </option>
                )}
              </select>
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">Biografía</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Creador de contenido gastronómico y cultural en Trujillo..."
              rows={2}
              maxLength={300}
              className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
            />
          </div>

          {/* Avatar URL */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">
              URL del Avatar / Foto de Perfil
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#E85B49]"
            />
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
