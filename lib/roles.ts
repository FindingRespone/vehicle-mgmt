export type AppRole = 'VEHICLE_MEMBER' | 'ADMIN' | 'SUPER_ADMIN' | 'FINANCE_READONLY';

export function isAdminOrAbove(role: string | undefined | null): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isSuperAdmin(role: string | undefined | null): boolean {
  return role === 'SUPER_ADMIN';
}

/** Can view all vehicles (admins only; finance is not a live role) */
export function canViewAllVehicles(role: string | undefined | null): boolean {
  return isAdminOrAbove(role);
}

/** Can view loans and installments */
export function canViewLoans(role: string | undefined | null): boolean {
  return isSuperAdmin(role);
}

/** Can create/update/delete vehicles and non-loan attachments */
export function canManageVehicles(role: string | undefined | null): boolean {
  return isAdminOrAbove(role);
}

/** Can view / upload / delete LOAN_CONTRACT attachments */
export function canAccessLoanContract(role: string | undefined | null): boolean {
  return isSuperAdmin(role);
}

export function canManageMembers(role: string | undefined | null): boolean {
  return isAdminOrAbove(role);
}

/** Can export fleet CSV (members: bound vehicles, no loans; admin: no loans; super admin: loans + schedule) */
export function canExportFleet(role: string | undefined | null): boolean {
  return role === 'VEHICLE_MEMBER' || isAdminOrAbove(role);
}

/** Can download attachment files (scope still enforced by vehicle membership / loan-contract rules) */
export function canDownloadAttachments(role: string | undefined | null): boolean {
  return role === 'VEHICLE_MEMBER' || isAdminOrAbove(role);
}
