import { useRef, useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { uploadAvatarApi } from '@/api/users.api';
import { useAuthStore } from '@/store/auth.store';
import AvatarCropDialog from '@/components/profile/AvatarCropDialog';

interface UseAvatarUploadOptions {
  username: string;
}

export function useAvatarUpload({ username }: UseAvatarUploadOptions) {
  const { t } = useTranslation('profile');
  const queryClient = useQueryClient();
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  // Revoke object URL on unmount only
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const mutation = useMutation({
    mutationFn: (blob: Blob) => {
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      return uploadAvatarApi(file);
    },
    onSuccess: (updated) => {
      setCurrentUser(updated);
      queryClient.invalidateQueries({ queryKey: ['userProfile', username] });
      toast.success(t('edit.avatarSuccess'));
      cleanup();
    },
    onError: () => {
      toast.error(t('edit.avatarError'));
    },
  });

  const cleanup = useCallback(() => {
    setCropOpen(false);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setImageSrc(null);
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const triggerFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous URL if any
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setImageSrc(objectUrl);
    setCropOpen(true);

    // Reset input value so the same file can be picked again
    e.target.value = '';
  }, []);

  const handleCropConfirm = useCallback((blob: Blob) => {
    mutation.mutate(blob);
  }, [mutation]);

  const handleCropClose = useCallback(() => {
    if (!mutation.isPending) {
      cleanup();
    }
  }, [mutation.isPending, cleanup]);

  // JSX element that consumers must render (hidden file input + crop dialog)
  const fileInputElement = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
      <AvatarCropDialog
        open={cropOpen}
        imageSrc={imageSrc}
        onConfirm={handleCropConfirm}
        onClose={handleCropClose}
        isProcessing={mutation.isPending}
      />
    </>
  );

  return {
    triggerFilePicker,
    fileInputElement,
    isUploading: mutation.isPending,
  };
}
