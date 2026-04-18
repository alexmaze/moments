import { useState } from 'react';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { uploadBackgroundApi } from '@/api/background.api';
import { useBackgroundStore } from '@/store/background.store';
import { useAuthStore } from '@/store/auth.store';

interface UseBackgroundUploadReturn {
  isUploading: boolean;
  /** Upload a background image. Returns the URL on success, null on failure. */
  uploadFile: (file: File) => Promise<string | null>;
}

export function useBackgroundUpload(): UseBackgroundUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const setBackground = useBackgroundStore((s) => s.setBackground);
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);

  const uploadFile = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const updatedUser = await uploadBackgroundApi(file);
      const url = updatedUser.background ?? null;
      setBackground(url);
      setCurrentUser(updatedUser);
      toast.success(i18n.t('profile:edit.backgroundUploadSuccess'));
      return url;
    } catch {
      toast.error(i18n.t('profile:edit.backgroundUploadError'));
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { isUploading, uploadFile };
}
