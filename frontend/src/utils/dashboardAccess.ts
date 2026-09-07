export type DashboardRoleGroup = 'owner' | 'employee';

const OWNER_DASHBOARD_ROLES = new Set(['OWNER', 'ADMIN']);
const EMPLOYEE_DASHBOARD_ROLES = new Set(['EMPLOYEE', 'STAFF']);

export function normalizeRole(role: string | null | undefined): string {
  return role?.trim().toUpperCase() ?? '';
}

export function getDashboardRoleGroup(
  role: string | null | undefined,
): DashboardRoleGroup | null {
  const normalizedRole = normalizeRole(role);

  if (OWNER_DASHBOARD_ROLES.has(normalizedRole)) return 'owner';
  if (EMPLOYEE_DASHBOARD_ROLES.has(normalizedRole)) return 'employee';
  return null;
}

export function canAccessDashboardPath(
  role: string | null | undefined,
  path: string,
): boolean {
  const group = getDashboardRoleGroup(role);
  if (!group) return false;

  if (path.startsWith('/owner/dashboard/')) return group === 'owner';
  if (path.startsWith('/employee/dashboard/')) return group === 'employee';
  return false;
}

export function getDashboardHome(role: string | null | undefined): string {
  const group = getDashboardRoleGroup(role);
  if (group === 'owner') return '/owner/dashboard/maindashboard';
  if (group === 'employee') return '/employee/dashboard/maindashboard';
  return '/login';
}
