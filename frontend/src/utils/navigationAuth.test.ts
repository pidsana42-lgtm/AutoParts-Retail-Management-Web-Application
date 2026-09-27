import { describe, it, expect, beforeEach } from 'vitest';
import {
  isNavigationAuthorized,
  registerAuthorizedId,
  getRegisteredAuthorizedId,
  clearRegisteredAuthorizedId,
  setLastValidPath,
  getLastValidPath,
} from './navigationAuth';

describe('navigationAuth utility', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('allows navigation when state.authorizedId matches target ID', () => {
    const result = isNavigationAuthorized({
      entity: 'order',
      id: 4,
      locationState: { authorizedId: 4 },
      skipTestBypass: true,
    });
    expect(result).toBe(true);
    expect(getRegisteredAuthorizedId('order')).toBe('4');
  });

  it('allows navigation when state.authorizedPoId matches target ID', () => {
    const result = isNavigationAuthorized({
      entity: 'order',
      id: 4,
      locationState: { authorizedPoId: 4 },
      skipTestBypass: true,
    });
    expect(result).toBe(true);
  });

  it('rejects navigation when user tampers with URL path (e.g. state is 4 but URL is 5)', () => {
    registerAuthorizedId('order', 4);
    const result = isNavigationAuthorized({
      entity: 'order',
      id: 5,
      locationState: { authorizedId: 4 },
      skipTestBypass: true,
    });
    expect(result).toBe(false);
  });

  it('rejects navigation when user enters URL directly without state or session', () => {
    const result = isNavigationAuthorized({
      entity: 'claim',
      id: 10,
      locationState: null,
      skipTestBypass: true,
    });
    expect(result).toBe(false);
  });

  it('allows F5 reload of the same ID when session storage matches', () => {
    registerAuthorizedId('claim', 9);
    const result = isNavigationAuthorized({
      entity: 'claim',
      id: 9,
      locationState: null, // browser reload clears locationState in some contexts
      skipTestBypass: true,
    });
    expect(result).toBe(true);
  });

  it('rejects URL tampering after reload when session was 9 but user changed URL to 10', () => {
    registerAuthorizedId('claim', 9);
    const result = isNavigationAuthorized({
      entity: 'claim',
      id: 10,
      locationState: null,
      skipTestBypass: true,
    });
    expect(result).toBe(false);
  });

  it('allows access with access token when allowToken is enabled (e.g. QR code)', () => {
    const result = isNavigationAuthorized({
      entity: 'stock_check',
      id: 3,
      locationState: null,
      allowToken: true,
      search: '?token=secret_scanner_token',
      skipTestBypass: true,
    });
    expect(result).toBe(true);
  });

  it('clears registered authorized ID properly', () => {
    registerAuthorizedId('return', 81);
    expect(getRegisteredAuthorizedId('return')).toBe('81');
    clearRegisteredAuthorizedId('return');
    expect(getRegisteredAuthorizedId('return')).toBeNull();
  });

  it('stores and retrieves last valid path', () => {
    expect(getLastValidPath()).toBeNull();
    setLastValidPath('/owner/orders/4');
    expect(getLastValidPath()).toBe('/owner/orders/4');
  });
});
