import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

export interface NavigationAuthState {
  authorizedId?: number | string;
  authorizedPoId?: number | string;
  [key: string]: unknown;
}

export function setLastValidPath(path: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('last_valid_path', path);
  } catch {}
}

export function getLastValidPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem('last_valid_path');
  } catch {
    return null;
  }
}

export function registerAuthorizedId(entity: string, id: number | string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`auth_id_${entity}`, String(id));
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function getRegisteredAuthorizedId(entity: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(`auth_id_${entity}`);
  } catch {
    return null;
  }
}

export function clearRegisteredAuthorizedId(entity: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(`auth_id_${entity}`);
  } catch {}
}

export function isNavigationAuthorized(options: {
  entity?: string;
  id: number | string | undefined;
  locationState: unknown;
  allowToken?: boolean;
  search?: string;
  skipTestBypass?: boolean;
}): boolean {
  // Bypass in test runner unless explicitly testing authorization
  if (!options.skipTestBypass && import.meta.env.MODE === 'test') {
    return true;
  }

  const { entity = 'default', id, locationState, allowToken, search } = options;
  if (!id) return false;

  // If route allows query access token (e.g. /wms/check-stock-scan/:id?token=...)
  if (allowToken && search && (search.includes('token=') || search.includes('access_token='))) {
    return true;
  }

  const targetId = String(id);
  const state = locationState as NavigationAuthState | null;

  // 1. Check React Router history state (passed from in-app click: authorizedId)
  const stateAuthId = state?.authorizedId ?? state?.authorizedPoId;
  if (stateAuthId !== undefined && stateAuthId !== null && String(stateAuthId) === targetId) {
    registerAuthorizedId(entity, targetId);
    return true;
  }

  // 2. Check session storage (persisted on legitimate view, allows F5 page reload of the same ID)
  const registeredId = getRegisteredAuthorizedId(entity);
  if (registeredId !== null && registeredId === targetId) {
    return true;
  }

  // If user tampered with URL (e.g. changed ID from 4 to 5 in address bar), both will mismatch
  return false;
}

export function useAuthorizedNavigation({
  entity,
  id,
  fallbackPath,
  allowToken = false,
}: {
  entity: string;
  id: number | string | undefined;
  fallbackPath: string;
  entityName?: string;
  allowToken?: boolean;
}): boolean {
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthorized = useMemo(() => {
    return isNavigationAuthorized({
      entity,
      id,
      locationState: location.state,
      allowToken,
      search: location.search,
    });
  }, [entity, id, location.state, allowToken, location.search]);

  useEffect(() => {
    if (isAuthorized) {
      setLastValidPath(location.pathname + location.search);
    }
  }, [isAuthorized, location.pathname, location.search]);

  useEffect(() => {
    if (!id) return;
    if (!isAuthorized) {
      const currentFull = location.pathname + location.search;
      const lastValid = getLastValidPath();
      const registeredId = getRegisteredAuthorizedId(entity);

      let targetPath = fallbackPath;
      if (lastValid && lastValid !== currentFull) {
        targetPath = lastValid;
      } else if (registeredId) {
        targetPath = location.pathname.replace(new RegExp(`/${id}(/|\\?|#|$)`), `/${registeredId}$1`);
      }

      navigate(targetPath, { replace: true });
    }
  }, [id, isAuthorized, fallbackPath, entity, navigate, location.pathname, location.search]);

  return isAuthorized;
}

export interface AuthorizedIdGuardProps {
  children: React.ReactElement;
  fallbackPath: string;
  entityName?: string;
  allowToken?: boolean;
  entity?: string;
}

/**
 * Route guard component placed directly in React Router.
 * Automatically intercepts and blocks URL tampering for any :id route
 * before the target page component can even mount or initiate API requests.
 * Reverts URL back to current valid page without showing any toast notification.
 */
export function AuthorizedIdGuard({
  children,
  fallbackPath,
  allowToken = false,
  entity,
}: AuthorizedIdGuardProps): React.JSX.Element | null {
  const params = useParams<Record<string, string>>();
  const id = params.id ?? params.orderId;
  const location = useLocation();
  const navigate = useNavigate();

  const entityKey = entity || location.pathname.split('/').filter(Boolean)[1] || 'default';

  const isAuthorized = useMemo(() => {
    return isNavigationAuthorized({
      entity: entityKey,
      id,
      locationState: location.state,
      allowToken,
      search: location.search,
    });
  }, [entityKey, id, location.state, allowToken, location.search]);

  useEffect(() => {
    if (isAuthorized) {
      setLastValidPath(location.pathname + location.search);
    }
  }, [isAuthorized, location.pathname, location.search]);

  useEffect(() => {
    if (!id) return;
    if (!isAuthorized) {
      const currentFull = location.pathname + location.search;
      const lastValid = getLastValidPath();
      const registeredId = getRegisteredAuthorizedId(entityKey);

      let targetPath = fallbackPath;
      if (lastValid && lastValid !== currentFull) {
        targetPath = lastValid;
      } else if (registeredId) {
        targetPath = location.pathname.replace(new RegExp(`/${id}(/|\\?|#|$)`), `/${registeredId}$1`);
      }

      navigate(targetPath, { replace: true });
    }
  }, [id, isAuthorized, fallbackPath, entityKey, navigate, location.pathname, location.search]);

  if (!isAuthorized) {
    return null;
  }

  return children;
}
