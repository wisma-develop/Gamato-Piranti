import { useCallback, useEffect, useRef, useState } from "react";
import { loadVideoMeta, type VideoMeta } from "@/lib/videoEngine";

export function useVideoFile() {
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  const load = useCallback(async (file: File) => {
    setError(null);
    setIsLoading(true);
    try {
      const m = await loadVideoMeta(file);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = m.url;
      setMeta(m);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat video.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setMeta(null);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  return { meta, error, isLoading, load, reset };
}
