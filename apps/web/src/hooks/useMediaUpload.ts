import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import i18n from "@/i18n";
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

/**
 * Generate a thumbnail from a video file using Canvas API.
 * Returns a data URL (JPEG) of the first frame, or empty string on failure.
 */
function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    const settle = (value: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    // Timeout after 5 seconds
    const timer = setTimeout(() => settle(""), 5000);

    video.onloadeddata = () => {
      // Seek to 0 to ensure first frame is rendered
      video.currentTime = 0;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          clearTimeout(timer);
          settle(canvas.toDataURL("image/jpeg", 0.8));
        } else {
          clearTimeout(timer);
          settle("");
        }
      } catch {
        clearTimeout(timer);
        settle("");
      }
    };

    video.onerror = () => {
      clearTimeout(timer);
      settle("");
    };

    video.src = objectUrl;
  });
}

export function useMediaUpload() {
  const [items, setItems] = useState<UploadItem[]>([]);

  const addFiles = useCallback(
    (files: File[]) => {
      const newItems: UploadItem[] = files.map((file) => ({
        localId: nextLocalId(),
        file,
        preview: file.type.startsWith("video/") ? "" : URL.createObjectURL(file),
        status: "uploading" as const,
        progress: 0,
        assetId: null,
        type: getMediaType(file),
        coverUrl: null,
      }));

      setItems((prev) => [...prev, ...newItems]);

      // Generate video thumbnails client-side (async, non-blocking)
      for (const item of newItems) {
        if (item.type === "video") {
          generateVideoThumbnail(item.file).then((dataUrl) => {
            if (dataUrl) {
              setItems((prev) =>
                prev.map((i) =>
                  i.localId === item.localId && !i.preview
                    ? { ...i, preview: dataUrl }
                    : i,
                ),
              );
            }
          });
        }
      }

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
            toast.error(i18n.t("feed:composer.uploadError"));
          });
      }
    },
    [items.length],
  );

  const removeItem = useCallback((localId: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.localId === localId);
      if (item && item.type === "image" && item.preview) {
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
        if (item.type === "image" && item.preview) {
          URL.revokeObjectURL(item.preview);
        }
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
