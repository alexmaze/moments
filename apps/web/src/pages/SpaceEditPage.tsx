import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Camera, ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ImageCropDialog from '@/components/media/ImageCropDialog';
import { uploadMediaApi } from '@/api/media.api';
import { useSpace, useUpdateSpace } from '@/hooks/useSpaces';

export default function SpaceEditPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation('spaces');
  const navigate = useNavigate();
  const { data: space, isLoading } = useSpace(slug!);
  const updateSpace = useUpdateSpace(slug!);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverMediaId, setCoverMediaId] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPositionY, setCoverPositionY] = useState(50);
  const [cropOpen, setCropOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [babyBirthday, setBabyBirthday] = useState('');

  useEffect(() => {
    if (!space) return;
    setName(space.name);
    setDescription(space.description ?? '');
    setCoverMediaId(space.coverMediaId ?? null);
    setCoverUrl(space.coverUrl);
    setCoverPositionY(space.coverPositionY);
    setBabyBirthday(space.babyBirthday ?? '');
  }, [space]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-80 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        {t('edit.notFound')}
      </div>
    );
  }

  const canEdit = space.myMembership?.role === 'owner' || space.myMembership?.role === 'admin';

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <Link
          to={`/spaces/${space.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('edit.backToSpace')}
        </Link>
        <div className="rounded-2xl border border-border surface-card p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">{t('edit.forbiddenTitle')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('edit.forbiddenDescription')}</p>
        </div>
      </div>
    );
  }

  const hasChanges =
    name.trim() !== space.name ||
    description !== (space.description ?? '') ||
    coverMediaId !== (space.coverMediaId ?? null) ||
    coverPositionY !== space.coverPositionY ||
    (babyBirthday || null) !== space.babyBirthday;

  const handleSelectCover = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setImageSrc(objectUrl);
    setCropOpen(true);
    event.target.value = '';
  };

  const handleCropClose = () => {
    setCropOpen(false);
    setImageSrc(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const handleCropConfirm = async ({ blob, focusY }: { blob: Blob; focusY: number }) => {
    setIsUploadingCover(true);
    try {
      const file = new File([blob], 'space-cover.jpg', { type: 'image/jpeg' });
      const uploaded = await uploadMediaApi(file);
      setCoverMediaId(uploaded.id);
      setCoverUrl(uploaded.publicUrl);
      setCoverPositionY(focusY);
      toast.success(t('edit.coverUploadSuccess'));
      handleCropClose();
    } catch {
      toast.error(t('edit.coverUploadError'));
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleSave = () => {
    const payload: {
      name: string;
      description: string;
      coverMediaId?: string | null;
      coverPositionY: number;
      babyBirthday: string | null;
    } = {
      name: name.trim(),
      description: description.trim(),
      coverPositionY,
      babyBirthday: babyBirthday || null,
    };
    if (coverMediaId !== (space.coverMediaId ?? null)) {
      payload.coverMediaId = coverMediaId;
    }
    updateSpace.mutate(payload, {
      onSuccess: (updated) => {
        toast.success(t('edit.saveSuccess'));
        navigate(`/spaces/${updated.slug}`);
      },
      onError: () => {
        toast.error(t('edit.saveError'));
      },
    });
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate(`/spaces/${space.slug}`)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('edit.backToSpace')}
      </button>

      <section className="overflow-hidden rounded-2xl border border-border surface-card shadow-sm">
        <div className="border-b border-border px-5 py-5 sm:px-6">
          <h1 className="text-xl font-bold text-foreground">{t('edit.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('edit.description')}</p>
        </div>

        <div className="space-y-8 p-5 sm:p-6">
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('edit.coverSectionTitle')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('edit.coverSectionDescription')}</p>
            </div>

            <div className="space-y-4 rounded-2xl border border-border/80 bg-background/40 p-4">
              <div className="overflow-hidden rounded-2xl border border-border bg-muted/30">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={name || space.name}
                    className="h-52 w-full object-cover"
                    style={{ objectPosition: `center ${coverPositionY}%` }}
                  />
                ) : (
                  <div className="flex h-52 items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5">
                    <div className="text-center text-muted-foreground">
                      <ImagePlus className="mx-auto h-8 w-8" />
                      <p className="mt-2 text-sm">{t('edit.coverEmpty')}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectCover}
                  disabled={isUploadingCover}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                  {coverUrl ? t('edit.coverReplace') : t('edit.coverUpload')}
                </button>

                {coverUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setCoverMediaId(null);
                      setCoverUrl(null);
                      setCoverPositionY(50);
                    }}
                    disabled={isUploadingCover}
                    className="inline-flex items-center gap-2 rounded-lg border border-destructive/20 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('edit.coverRemove')}
                  </button>
                )}
              </div>

              {coverUrl && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    {t('edit.coverPosition')}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={coverPositionY}
                    onChange={(event) => setCoverPositionY(Number(event.target.value))}
                    className="w-full accent-primary"
                  />
                  <p className="text-xs text-muted-foreground">{t('edit.coverPositionHint')}</p>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('edit.infoSectionTitle')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('edit.infoSectionDescription')}</p>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  {t('create.name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  {t('create.description')}
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder={t('create.descriptionPlaceholder')}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  {t('edit.slugLabel')}
                </label>
                <div className="rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  /spaces/{space.slug}
                </div>
              </div>

              {space.type === 'baby' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    {t('edit.babyBirthdayLabel')}
                  </label>
                  <input
                    type="date"
                    value={babyBirthday}
                    onChange={(event) => setBabyBirthday(event.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('edit.babyBirthdayHint')}
                  </p>
                </div>
              )}
            </div>
          </section>

          <div className="flex justify-end border-t border-border pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={updateSpace.isPending || isUploadingCover || !name.trim() || !hasChanges}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateSpace.isPending ? t('edit.saving') : t('edit.save')}
            </button>
          </div>
        </div>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      <ImageCropDialog
        open={cropOpen}
        imageSrc={imageSrc}
        title={t('edit.coverCropTitle')}
        cancelLabel={t('edit.coverCropCancel')}
        confirmLabel={t('edit.coverCropConfirm')}
        zoomLabel={t('edit.coverZoom')}
        errorLabel={t('edit.coverUploadError')}
        aspect={3}
        outputWidth={1800}
        outputHeight={600}
        onConfirm={handleCropConfirm}
        onClose={handleCropClose}
        isProcessing={isUploadingCover}
      />
    </div>
  );
}
