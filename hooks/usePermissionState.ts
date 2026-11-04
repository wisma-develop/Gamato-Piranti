import { useEffect, useState } from "react";
import { watchPermission, type PermKind, type PermState } from "@/lib/permissions";

/**
 * Status izin real-time (granted / denied / prompt / unknown) — ikut berubah bila pengguna
 * mengubah setelan situs saat halaman terbuka. Tidak pernah memunculkan prompt.
 */
export function usePermissionState(kind: PermKind): PermState {
  const [state, setState] = useState<PermState>("unknown");
  useEffect(() => watchPermission(kind, setState), [kind]);
  return state;
}
