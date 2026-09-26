'use client';

import { createContext, useContext } from 'react';

/** Which portfolio the page shows: '' = the owner's site, otherwise a member's slug. */
export const TenantContext = createContext('');

/** Adds `u=<slug>` to API URLs for member portfolios (no-op on the owner's site). */
export const withTenant = (url: string, tenant: string) => (tenant ? `${url}${url.includes('?') ? '&' : '?'}u=${encodeURIComponent(tenant)}` : url);

export function useTenantUrl() {
  const tenant = useContext(TenantContext);
  return (url: string) => withTenant(url, tenant);
}
