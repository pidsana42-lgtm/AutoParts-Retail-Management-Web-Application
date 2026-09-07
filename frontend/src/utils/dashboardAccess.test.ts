import { describe, expect, it } from 'vitest';
import { canAccessDashboardPath, getDashboardHome, getDashboardRoleGroup, normalizeRole } from './dashboardAccess';

describe('dashboard access policy', () => {
  it.each([
    ['Admin', 'owner'],
    ['OWNER', 'owner'],
    ['employee', 'employee'],
    [' Staff ', 'employee'],
  ] as const)('maps %s to the %s dashboard group', (role, expected) => {
    expect(getDashboardRoleGroup(role)).toBe(expected);
  });

  it.each([null, undefined, '', 'guest', 'manager'])('rejects unknown role %s', (role) => {
    expect(getDashboardRoleGroup(role)).toBeNull();
    expect(getDashboardHome(role)).toBe('/login');
  });

  it('allows Admin only on owner dashboard paths', () => {
    expect(canAccessDashboardPath('Admin', '/owner/dashboard/maindashboard')).toBe(true);
    expect(canAccessDashboardPath('Admin', '/employee/dashboard/maindashboard')).toBe(false);
  });

  it('allows Employee only on employee dashboard paths', () => {
    expect(canAccessDashboardPath('Employee', '/employee/dashboard/salesdashboard')).toBe(true);
    expect(canAccessDashboardPath('Employee', '/owner/dashboard/salesdashboard')).toBe(false);
  });

  it('normalizes role values consistently', () => {
    expect(normalizeRole(' admin ')).toBe('ADMIN');
    expect(normalizeRole(null)).toBe('');
  });
});
