import { useState, useCallback, useMemo } from "react";
import { uploadMediaApi } from "@/api/media.api";

export interface UploadItem {
  localId: string;
  file: File;
  preview: string;
  status: "uploading" | "done" | "error";
  progress: number;
  assetId: string | null;
  type: "image" | "video";
  coverUrl: string | null;
}

let idCounter = 0;
function nextLocalId() {
  return `upload-${Date.now()}-${++idCounter}`;
}

function getMediaType(file: File): "image" | "video" {
  return file.type.startsWith("video/") ? "video" : "image";
}

export function useMediaUpload(maxFiles = 9) {
  const [items, setItems] = useState<UploadItem[]>([]);

  const addFiles = useCallback(
    (files: File[]) => {
      const remaining = maxFiles - items.length;
      const toAdd = files.slice(0, remaining);

      const newItems: UploadItem[] = toAdd.map((file) => ({
        localId: nextLocalId(),
        file,
        preview: URL.createObjectURL(file),
        status: "uploading" as const,
        progress: 0,
        assetId: null,
        type: getMediaType(file),
        coverUrl: null,
      }));

      setItems((prev) => [...prev, ...newItems]);

      // Start parallel uploads
      for (const item of newItems) {
        uploadMediaApi(item.file, (pct) => {
          setItems((prev) =>
            prev.map((i) =>
              i.localId === item.localId ? { ...i, progress: pct } : i,
            ),
          );
        })
          .then((res) => {
            setItems((prev) =>
              prev.map((i) =>
                i.localId === item.localId
                  ? {
                      ...i,
                      status: "done" as const,
                      progress: 100,
                      assetId: res.id,
                      coverUrl: res.coverUrl,
                    }
                  : i,
              ),
            );
          })
          .catch(() => {
            setItems((prev) =>
              prev.map((i) =>
                i.localId === item.localId
                  ? { ...i, status: "error" as const }
                  : i,
              ),
            );
          });
      }
    },
    [items.length, maxFiles],
  );

  const removeItem = useCallback((localId: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.localId === localId);
      if (item) {
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter((i) => i.localId !== localId);
    });
  }, []);

  const reorderItems = useCallback((fromIndex: number, toIndex: number) => {
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setItems((prev) => {
      for (const item of prev) {
        URL.revokeObjectURL(item.preview);
      }
      return [];
    });
  }, []);

  const readyIds = useMemo(
    () =>
      items
        .filter((i) => i.status === "done" && i.assetId)
        .map((i) => i.assetId!),
    [items],
  );

  const allUploaded = useMemo(
    () => items.length > 0 && items.every((i) => i.status === "done"),
    [items],
  );

  const isUploading = useMemo(
    () => items.some((i) => i.status === "uploading"),
    [items],
  );

  return {
    items,
    addFiles,
    removeItem,
    reorderItems,
    reset,
    readyIds,
    allUploaded,
    isUploading,
  };
}
