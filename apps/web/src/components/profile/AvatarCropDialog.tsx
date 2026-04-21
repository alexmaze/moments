import { useTranslation } from 'react-i18next';
import ImageCropDialog from '@/components/media/ImageCropDialog';

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

  return (
    <ImageCropDialog
      open={open}
      imageSrc={imageSrc}
      title={t('edit.avatarCropTitle')}
      cancelLabel={t('edit.avatarCancel')}
      confirmLabel={t('edit.avatarConfirm')}
      zoomLabel={t('edit.avatarZoom')}
      errorLabel={t('edit.avatarError')}
      aspect={1}
      outputWidth={512}
      outputHeight={512}
      onConfirm={({ blob }) => onConfirm(blob)}
      onClose={onClose}
      isProcessing={isProcessing}
    />
  );
}
