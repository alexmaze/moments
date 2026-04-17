import type { UploadItem } from '@/hooks/useMediaUpload';

interface MediaUploaderProps {
  items: UploadItem[];
  addFiles: (files: File[]) => void;
  removeItem: (id: string) => void;
}

export default function MediaUploader({ items, addFiles, removeItem }: MediaUploaderProps) {
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
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-4 h-4 ml-0.5">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
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
                <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                  <span className="text-xs text-white bg-red-500 px-2 py-0.5 rounded">
                    Failed
                  </span>
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={() => removeItem(item.localId)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-3.5 h-3.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}

          {/* Add more button */}
          <label className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-accent transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-muted-foreground">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 mx-auto text-muted-foreground">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p className="mt-2 text-sm text-muted-foreground">
            Drop photos or videos here, or tap to browse
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
