import { useEffect, useState } from "react";

/**
 * Loads a data URL (e.g. a signature captured via <SignaturePad>, which is
 * already an in-memory string rather than a File) as an <img>-compatible
 * HTMLImageElement, ready for canvas.drawImage(). Mirrors useImageFromFile,
 * just skipping the FileReader step since there's no File involved.
 */
export function useImageFromDataUrl(dataUrl: string | null | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!dataUrl) {
      setImg(null);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setImg(image);
    };
    image.onerror = () => {
      if (!cancelled) setImg(null);
    };
    image.src = dataUrl;
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  return img;
}
