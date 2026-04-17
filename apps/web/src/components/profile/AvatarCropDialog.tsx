import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cropImage } from '@/lib/cropImage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';

interface AvatarCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  onConfirm: (blob: Blob) => void;
  onClose: () => void;
  isProcessing?: boolean;
}

export default function AvatarCropDialog({
  open,
  imageSrc,
  onConfirm,
  onClose,
  isProcessing,
}: AvatarCropDialogProps) {
  const { t } = useTranslation('profile');

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  // Reset crop state when dialog opens with a new image
  useEffect(() => {
    if (open && imageSrc) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedArea(null);
    }
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedArea) return;
    setIsCropping(true);
    try {
      const blob = await cropImage(imageSrc, croppedArea);
      onConfirm(blob);
    } catch {
      toast.error(t('edit.avatarError'));
    } finally {
      setIsCropping(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v && !isCropping && !isProcessing) {
      onClose();
    }
  };

  const busy = isCropping || !!isProcessing;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('edit.avatarCropTitle')}</DialogTitle>
        </DialogHeader>

        {/* Cropper area */}
        <div className="relative w-full aspect-square bg-black">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        {/* Zoom slider */}
        <div className="px-4 py-2">
          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="shrink-0">{t('edit.avatarZoom')}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-4 py-2 border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {t('edit.avatarCancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !croppedArea}
            className="rounded-lg px-4 py-2 bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {busy ? (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              t('edit.avatarConfirm')
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
