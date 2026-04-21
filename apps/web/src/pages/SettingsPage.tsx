import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Camera, Palette, Settings, User } from 'lucide-react';
import { toast } from 'sonner';
import { updateProfileApi } from '@/api/users.api';
import BackgroundPicker from '@/components/profile/BackgroundPicker';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import i18n from '@/i18n';
import { useAuthStore } from '@/store/auth.store';
import { detectBrowserLocale } from '@/store/locale.store';
import { useThemeStore } from '@/store/theme.store';
import { useBackgroundStore } from '@/store/background.store';
import { cn } from '@/lib/utils';
import type { SupportedLocale, SupportedTheme } from '@/types/dto';

type Tab = 'profile' | 'appearance';

function SettingsTabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof User;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
      )}
    </button>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation('profile');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const liveAvatarUrl = useAuthStore((s) => s.currentUser?.avatarUrl);
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setBackground = useBackgroundStore((s) => s.setBackground);

  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [localeValue, setLocaleValue] = useState<string>(currentUser?.locale ?? 'auto');
  const [themeValue, setThemeValue] = useState<string>(currentUser?.theme ?? 'system');
  const [backgroundValue, setBackgroundValue] = useState<string | null>(currentUser?.background ?? null);

  useEffect(() => {
    if (!currentUser) return;
    setDisplayName(currentUser.displayName);
    setBio(currentUser.bio ?? '');
    setLocaleValue(currentUser.locale ?? 'auto');
    setThemeValue(currentUser.theme ?? 'system');
    setBackgroundValue(currentUser.background ?? null);
  }, [currentUser]);

  const avatarUpload = useAvatarUpload({ username: currentUser?.username ?? '' });

  const profileDirty = !!currentUser && (
    displayName !== currentUser.displayName ||
    bio !== (currentUser.bio ?? '') ||
    localeValue !== (currentUser.locale ?? 'auto')
  );

  const appearanceDirty = !!currentUser && (
    themeValue !== (currentUser.theme ?? 'system') ||
    backgroundValue !== (currentUser.background ?? null)
  );

  const profileMutation = useMutation({
    mutationFn: updateProfileApi,
    onSuccess: (updated) => {
      setCurrentUser(updated);
      if (updated.locale === null) {
        const browserLocale = detectBrowserLocale();
        if (i18n.language !== browserLocale) {
          i18n.changeLanguage(browserLocale);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['userProfile', updated.username] });
      toast.success(t('settings.profileSaved'));
    },
    onError: () => {
      toast.error(t('edit.saveError'));
    },
  });

  const appearanceMutation = useMutation({
    mutationFn: updateProfileApi,
    onSuccess: (updated) => {
      setCurrentUser(updated);
      queryClient.invalidateQueries({ queryKey: ['userProfile', updated.username] });
      toast.success(t('settings.appearanceSaved'));
    },
    onError: () => {
      if (!currentUser) return;
      setTheme(currentUser.theme ?? null);
      setBackground(currentUser.background ?? null);
      setThemeValue(currentUser.theme ?? 'system');
      setBackgroundValue(currentUser.background ?? null);
      toast.error(t('edit.saveError'));
    },
  });

  if (!currentUser) {
    return null;
  }

  const handleProfileSave = () => {
    profileMutation.mutate({
      displayName: displayName.trim(),
      bio: bio.trim() || undefined,
      locale: localeValue === 'auto' ? null : (localeValue as SupportedLocale),
    });
  };

  const handleAppearanceSave = () => {
    appearanceMutation.mutate({
      theme: themeValue === 'system' ? null : (themeValue as SupportedTheme),
      background: backgroundValue,
    });
  };

  const displayAvatarUrl = liveAvatarUrl ?? currentUser.avatarUrl;

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </button>

      <section className="surface-card rounded-2xl border border-border shadow-sm">
        <div className="border-b border-border px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {t('settings.title')}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('settings.description')}
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-border px-2 sm:px-4">
          <div className="flex">
            <SettingsTabButton
              active={activeTab === 'profile'}
              icon={User}
              label={t('settings.tabs.profile')}
              onClick={() => setActiveTab('profile')}
            />
            <SettingsTabButton
              active={activeTab === 'appearance'}
              icon={Palette}
              label={t('settings.tabs.appearance')}
              onClick={() => setActiveTab('appearance')}
            />
          </div>
        </div>

        {activeTab === 'profile' ? (
          <div className="space-y-6 p-5 sm:p-6">
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t('settings.profileSectionTitle')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('settings.profileSectionDescription')}
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={avatarUpload.triggerFilePicker}
                    className="relative shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    aria-label={t('edit.avatarChange')}
                  >
                    {displayAvatarUrl ? (
                      <img
                        src={displayAvatarUrl}
                        alt={currentUser.displayName}
                        className="h-20 w-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className={cn(
                      'absolute inset-0 flex items-center justify-center rounded-full bg-black/50 transition-opacity',
                      avatarUpload.isUploading ? 'opacity-100' : 'opacity-0',
                    )}>
                      {avatarUpload.isUploading ? (
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Camera className="h-6 w-6 text-white" />
                      )}
                    </div>
                  </button>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {t('settings.avatarTitle')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('settings.avatarDescription')}
                    </p>
                    <button
                      type="button"
                      onClick={avatarUpload.triggerFilePicker}
                      className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      {t('edit.avatarChange')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    {t('edit.displayNameLabel')}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    {t('edit.bioLabel')}
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t('edit.bioPlaceholder')}
                    rows={4}
                    maxLength={300}
                    className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    {t('edit.languageLabel')}
                  </label>
                  <select
                    value={localeValue}
                    onChange={(e) => setLocaleValue(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="auto">{t('edit.languageAuto')}</option>
                    <option value="en">English</option>
                    <option value="zh-CN">中文（简体）</option>
                  </select>
                </div>
              </div>
            </section>

            <div className="flex justify-end border-t border-border pt-4">
              <button
                type="button"
                onClick={handleProfileSave}
                disabled={profileMutation.isPending || !profileDirty || !displayName.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {profileMutation.isPending ? t('edit.saving') : t('edit.save')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 p-5 sm:p-6">
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t('settings.appearanceSectionTitle')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('settings.appearanceSectionDescription')}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  {t('edit.themeLabel')}
                </label>
                <select
                  value={themeValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    setThemeValue(value);
                    setTheme(value === 'system' ? null : (value as SupportedTheme));
                  }}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="system">{t('edit.themeSystem')}</option>
                  <option value="light">{t('edit.themeLight')}</option>
                  <option value="dark">{t('edit.themeDark')}</option>
                </select>
              </div>

              <BackgroundPicker
                value={backgroundValue}
                onChange={(bg) => {
                  setBackgroundValue(bg);
                  setBackground(bg);
                }}
              />
            </section>

            <div className="flex justify-end border-t border-border pt-4">
              <button
                type="button"
                onClick={handleAppearanceSave}
                disabled={appearanceMutation.isPending || !appearanceDirty}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {appearanceMutation.isPending ? t('edit.saving') : t('edit.save')}
              </button>
            </div>
          </div>
        )}
      </section>

      {avatarUpload.fileInputElement}
    </div>
  );
}
