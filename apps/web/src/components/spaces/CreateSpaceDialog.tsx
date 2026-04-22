import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCreateSpace } from '@/hooks/useSpaces';
import type { SpaceType } from '@/types/dto';

interface CreateSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateSpaceDialog({ open, onOpenChange }: CreateSpaceDialogProps) {
  const { t } = useTranslation('spaces');
  const navigate = useNavigate();
  const createSpace = useCreateSpace();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [type, setType] = useState<SpaceType>('general');
  const [babyBirthday, setBabyBirthday] = useState('');

  useEffect(() => {
    if (!slugManuallyEdited) {
      setSlug(toSlug(name));
    }
  }, [name, slugManuallyEdited]);

  useEffect(() => {
    if (open) {
      setName('');
      setSlug('');
      setSlugManuallyEdited(false);
      setDescription('');
      setType('general');
      setBabyBirthday('');
    }
  }, [open]);

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    createSpace.mutate(
      { name: name.trim(), slug: slug.trim(), description: description.trim() || undefined, type, babyBirthday: type === 'baby' && babyBirthday ? babyBirthday : undefined },
      {
        onSuccess: (data) => {
          onOpenChange(false);
          navigate(`/spaces/${data.slug}`);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-4">
          {/* Name */}
          <div>
            <label htmlFor="space-name" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('create.name')}
            </label>
            <input
              id="space-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('create.namePlaceholder')}
              maxLength={100}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Slug */}
          <div>
            <label htmlFor="space-slug" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('create.slug')}
            </label>
            <div className="flex items-center rounded-lg border border-border bg-background text-sm">
              <span className="shrink-0 px-3 text-muted-foreground">/spaces/</span>
              <input
                id="space-slug"
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder={t('create.slugPlaceholder')}
                maxLength={100}
                className="w-full rounded-r-lg border-0 bg-transparent py-2 pr-3 text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t('create.slugHelp')}</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="space-desc" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('create.description')}
            </label>
            <textarea
              id="space-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('create.descriptionPlaceholder')}
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {t('create.type')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('general')}
                className={`rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                  type === 'general'
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/30'
                }`}
              >
                <div className="text-sm font-medium">{t('create.typeGeneral')}</div>
              </button>
              <button
                type="button"
                onClick={() => setType('baby')}
                className={`rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                  type === 'baby'
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/30'
                }`}
              >
                <div className="text-sm font-medium">{t('create.typeBaby')} 🍼</div>
              </button>
            </div>
          </div>

          {type === 'baby' && (
            <div>
              <label htmlFor="space-birthday" className="mb-1.5 block text-sm font-medium text-foreground">
                {t('create.babyBirthdayLabel')}
              </label>
              <input
                id="space-birthday"
                type="date"
                value={babyBirthday}
                onChange={(e) => setBabyBirthday(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t('create.babyBirthdayHint')}
              </p>
            </div>
          )}

          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {t('growth.cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !slug.trim() || createSpace.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {t('create.submit')}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
