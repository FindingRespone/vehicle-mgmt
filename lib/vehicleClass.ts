export const VEHICLE_CLASS_LABELS = {
  TRUCK: '货车',
  SEDAN: '轿车',
  MPV: 'MPV',
  OTHER: '其他',
} as const;

export type VehicleClassValue = keyof typeof VEHICLE_CLASS_LABELS;

export const VEHICLE_CLASS_OPTIONS: { value: VehicleClassValue; label: string }[] = [
  { value: 'TRUCK', label: VEHICLE_CLASS_LABELS.TRUCK },
  { value: 'SEDAN', label: VEHICLE_CLASS_LABELS.SEDAN },
  { value: 'MPV', label: VEHICLE_CLASS_LABELS.MPV },
  { value: 'OTHER', label: VEHICLE_CLASS_LABELS.OTHER },
];

export function formatVehicleClass(value: string | null | undefined): string {
  if (!value) return '';
  return VEHICLE_CLASS_LABELS[value as VehicleClassValue] || value;
}
