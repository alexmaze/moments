/**
 * Crops an image to the specified area and resizes to a square output.
 *
 * @param imageSrc - Object URL or data URL of the source image
 * @param croppedAreaPixels - Pixel coordinates from react-easy-crop's onCropComplete
 * @param outputSize - Output square size in pixels (default 512)
 * @returns JPEG Blob (quality 0.9)
 */
export async function cropImage(
  imageSrc: string,
  croppedAreaPixels: { x: number; y: number; width: number; height: number },
  outputSize = 512,
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas 2d context');
  }

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob returned null'));
        }
      },
      'image/jpeg',
      0.9,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}
