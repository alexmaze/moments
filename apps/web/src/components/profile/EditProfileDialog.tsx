import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateProfileApi } from '@/api/users.api';
import { useAuthStore } from '@/store/auth.store';
import { detectBrowserLocale } from '@/store/locale.store';
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

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? '');
  // 'auto' in the select = null in DB (follow browser)
  const [localeValue, setLocaleValue] = useState<string>(profile.locale ?? 'auto');

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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('edit.title')}</DialogTitle>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
      </DialogContent>
    </Dialog>
  );
}
