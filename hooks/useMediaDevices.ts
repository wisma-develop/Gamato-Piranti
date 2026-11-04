import { useCallback, useEffect, useState } from "react";
import { listMediaDevices, onDeviceChange, type MediaDeviceOption } from "@/lib/permissions";

/**
 * Daftar kamera / mikrofon / speaker. Label perangkat baru terisi setelah izin diberikan,
 * jadi panggil `refresh()` sesudah getUserMedia berhasil. Otomatis ikut berubah bila
 * headset/kamera dicolok atau dicabut.
 */
export function useMediaDevices(kind: "videoinput" | "audioinput" | "audiooutput") {
  const [devices, setDevices] = useState<MediaDeviceOption[]>([]);
  const refresh = useCallback(async () => { setDevices(await listMediaDevices(kind)); }, [kind]);
  useEffect(() => {
    void refresh();
    return onDeviceChange(() => { void refresh(); });
  }, [refresh]);
  return { devices, refresh };
}
