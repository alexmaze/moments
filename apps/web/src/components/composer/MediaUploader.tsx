import { useTranslation } from 'react-i18next';
import { Plus, X, Play, Image } from 'lucide-react';
import type { UploadItem } from '@/hooks/useMediaUpload';

interface MediaUploaderProps {
  items: UploadItem[];
  addFiles: (files: File[]) => void;
  removeItem: (id: string) => void;
}

export default function MediaUploader({ items, addFiles, removeItem }: MediaUploaderProps) {
  const { t } = useTranslation('feed');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <div key={item.localId} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
              {item.preview ? (
                <>
                  <img
                    src={item.preview}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {item.file.type.startsWith('video/') && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                        <Play className="w-4 h-4 ml-0.5" fill="white" stroke="white" />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Progress bar */}
              {item.status === 'uploading' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}

              {/* Error indicator */}
              {item.status === 'error' && (
                <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
                  <span className="text-xs text-destructive-foreground bg-destructive px-2 py-0.5 rounded">
                    {t('uploader.failed')}
                  </span>
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={() => removeItem(item.localId)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <X className="w-3.5 h-3.5" stroke="white" />
              </button>
            </div>
          ))}

          {/* Add more button */}
          <label className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-accent transition-colors">
            <Plus className="w-6 h-6 text-muted-foreground" />
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      )}

      {items.length === 0 && (
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="block border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-accent transition-colors"
        >
          <Image className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {t('uploader.dropzone')}
          </p>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}
