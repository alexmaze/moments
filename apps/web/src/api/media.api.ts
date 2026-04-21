import apiClient from "./client";

interface UploadMediaResponse {
  id: string;
  type: "image" | "video";
  publicUrl: string;
  coverUrl: string | null;
}

export function uploadMediaApi(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadMediaResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return apiClient.post("/media/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
}
