export interface DrivingLicenseMeta {
  vehicleType?: string;
  ownerName?: string;
  useNature?: string;
}

export function parseDrivingLicenseMeta(value: unknown): DrivingLicenseMeta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const raw = value as Record<string, unknown>;
  const pick = (key: string) => {
    const v = raw[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };

  return {
    vehicleType: pick('vehicleType'),
    ownerName: pick('ownerName'),
    useNature: pick('useNature'),
  };
}

export function serializeDrivingLicenseMeta(meta: DrivingLicenseMeta): DrivingLicenseMeta | null {
  const cleaned = parseDrivingLicenseMeta(meta);
  return Object.values(cleaned).some(Boolean) ? cleaned : null;
}
