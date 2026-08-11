import { useEffect, useState } from "react";
import { fileToDataUrl } from "@/lib/file";

/** Loads an uploaded File as an <img>-compatible HTMLImageElement, ready for canvas.drawImage(). */
export function useImageFromFile(file: File | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!file) {
      setImg(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const dataUrl = await fileToDataUrl(file);
      const image = new Image();
      image.onload = () => {
        if (!cancelled) setImg(image);
      };
      image.src = dataUrl;
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  return img;
}
