import { GamatoSelect } from "@/components/ui/GamatoSelect";
import type { MediaDeviceOption } from "@/lib/permissions";

/**
 * MediaDevicePicker — pilih kamera / mikrofon (memakai GamatoSelect, bukan <select> bawaan).
 * Disembunyikan otomatis bila hanya ada ≤1 perangkat.
 */
export function MediaDevicePicker({
  label,
  devices,
  value,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  devices: MediaDeviceOption[];
  value: string;
  onChange: (deviceId: string) => void;
  disabled?: boolean;
  testId?: string;
}) {
  if (devices.length < 2) return null;
  return (
    <GamatoSelect
      label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
    >
      <option value="">Otomatis (bawaan)</option>
      {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
    </GamatoSelect>
  );
}
