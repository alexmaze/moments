import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateProfileApi } from '@/api/users.api';
import { useAuthStore } from '@/store/auth.store';
import { detectBrowserLocale } from '@/store/locale.store';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import i18n from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { UserDto, SupportedLocale } from '@/types/dto';

interface EditProfileDialogProps {
  open: boolean;
  onClose: () => void;
  profile: UserDto;
}

export default function EditProfileDialog({ open, onClose, profile }: EditProfileDialogProps) {
  const { t } = useTranslation('profile');
  const queryClient = useQueryClient();
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? '');
  // 'auto' in the select = null in DB (follow browser)
  const [localeValue, setLocaleValue] = useState<string>(profile.locale ?? 'auto');

  const avatarUpload = useAvatarUpload({ username: profile.username });

  const mutation = useMutation({
    mutationFn: updateProfileApi,
    onSuccess: (updated) => {
      setCurrentUser(updated);
      // If user chose "follow browser", switch i18n to browser locale immediately
      if (updated.locale === null) {
        const browserLocale = detectBrowserLocale();
        if (i18n.language !== browserLocale) {
          i18n.changeLanguage(browserLocale);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['userProfile', profile.username] });
      toast.success(t('edit.saveSuccess'));
      onClose();
    },
    onError: () => {
      toast.error(t('edit.saveError'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      displayName: displayName.trim(),
      bio: bio.trim() || undefined,
      locale: localeValue === 'auto' ? null : (localeValue as SupportedLocale),
    });
  };

  // Use the live avatarUrl from auth store (updates immediately after upload)
  const displayAvatarUrl = currentUser?.avatarUrl ?? profile.avatarUrl;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !avatarUpload.isUploading) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('edit.title')}</DialogTitle>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={avatarUpload.triggerFilePicker}
              className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {displayAvatarUrl ? (
                <img
                  src={displayAvatarUrl}
                  alt={profile.displayName}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 text-muted-foreground">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
              {/* Overlay */}
              <div className={`absolute inset-0 rounded-full flex items-center justify-center bg-black/50 transition-opacity ${
                avatarUpload.isUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}>
                {avatarUpload.isUploading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-6 h-6">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </div>
            </button>
            <span className="text-xs text-muted-foreground">
              {t('edit.avatarChange')}
            </span>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('edit.displayNameLabel')}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={100}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('edit.bioLabel')}
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('edit.bioPlaceholder')}
              rows={3}
              className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={300}
            />
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('edit.languageLabel')}
            </label>
            <select
              value={localeValue}
              onChange={(e) => setLocaleValue(e.target.value)}
              className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="auto">{t('edit.languageAuto')}</option>
              <option value="en">English</option>
              <option value="zh-CN">中文（简体）</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={mutation.isPending || !displayName.trim()}
              className="rounded-lg px-4 py-2 bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {mutation.isPending ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                t('edit.save')
              )}
            </button>
          </div>
        </form>

        {/* Hidden file input + crop dialog from the hook */}
        {avatarUpload.fileInputElement}
      </DialogContent>
    </Dialog>
  );
}
