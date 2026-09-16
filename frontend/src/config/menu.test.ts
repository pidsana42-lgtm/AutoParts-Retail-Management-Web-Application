import { describe, it, expect } from 'vitest';
import { getMenuByRole } from './menu';

describe('getMenuByRole', () => {
  it('should return only /manager paths for MANAGER role without any /owner path', () => {
    const menus = getMenuByRole('MANAGER');
    expect(menus.length).toBeGreaterThan(0);

    for (const menu of menus) {
      expect(menu.path).not.toMatch(/^\/owner/);
      if (menu.subs) {
        for (const sub of menu.subs) {
          expect(sub.path).not.toMatch(/^\/owner/);
        }
      }
    }

    const firstMenu = menus[0];
    expect(firstMenu.path).toBe('/manager/dashboard/maindashboard');
  });

  it('should return /owner paths for OWNER role without any /manager path', () => {
    const menus = getMenuByRole('OWNER');
    expect(menus.length).toBeGreaterThan(0);

    for (const menu of menus) {
      expect(menu.path).not.toMatch(/^\/manager/);
      if (menu.subs) {
        for (const sub of menu.subs) {
          expect(sub.path).not.toMatch(/^\/manager/);
        }
      }
    }

    const firstMenu = menus[0];
    expect(firstMenu.path).toBe('/owner/dashboard/maindashboard');
  });

  it('should return /employee paths for EMPLOYEE role', () => {
    const menus = getMenuByRole('EMPLOYEE');
    expect(menus.length).toBeGreaterThan(0);

    for (const menu of menus) {
      expect(menu.path).not.toMatch(/^\/(owner|manager)/);
    }

    const firstMenu = menus[0];
    expect(firstMenu.path).toBe('/employee/dashboard/maindashboard');
  });
});
