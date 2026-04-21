import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { toast } from 'sonner';
import { cropImage } from '@/lib/cropImage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';

interface ImageCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  title: string;
  cancelLabel: string;
  confirmLabel: string;
  zoomLabel: string;
  errorLabel: string;
  aspect: number;
  outputWidth: number;
  outputHeight: number;
  onConfirm: (result: { blob: Blob; focusY: number }) => void;
  onClose: () => void;
  isProcessing?: boolean;
}

export default function ImageCropDialog({
  open,
  imageSrc,
  title,
  cancelLabel,
  confirmLabel,
  zoomLabel,
  errorLabel,
  aspect,
  outputWidth,
  outputHeight,
  onConfirm,
  onClose,
  isProcessing,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedAreaPercentages, setCroppedAreaPercentages] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  useEffect(() => {
    if (open && imageSrc) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setCroppedAreaPercentages(null);
    }
  }, [open, imageSrc]);

  const handleCropComplete = useCallback((percentages: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
    setCroppedAreaPercentages(percentages);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels || !croppedAreaPercentages) return;

    setIsCropping(true);
    try {
      const blob = await cropImage(imageSrc, croppedAreaPixels, {
        width: outputWidth,
        height: outputHeight,
      });
      const focusY = Math.max(
        0,
        Math.min(100, croppedAreaPercentages.y + croppedAreaPercentages.height / 2),
      );
      onConfirm({ blob, focusY });
    } catch {
      toast.error(errorLabel);
    } finally {
      setIsCropping(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isCropping && !isProcessing) {
      onClose();
    }
  };

  const busy = isCropping || !!isProcessing;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: String(aspect) }}>
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          )}
        </div>

        <div className="px-1">
          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="shrink-0">{zoomLabel}</span>
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
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !croppedAreaPixels}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              confirmLabel
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
