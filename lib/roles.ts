export type AppRole = 'VEHICLE_MEMBER' | 'ADMIN' | 'SUPER_ADMIN' | 'FINANCE_READONLY';

export function isAdminOrAbove(role: string | undefined | null): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isSuperAdmin(role: string | undefined | null): boolean {
  return role === 'SUPER_ADMIN';
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
