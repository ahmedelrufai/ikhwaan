import { safeAdminPath } from './admin-routes.ts';
import { safePortalPath } from './portal-routes.ts';
import { administrativeAccess, memberDashboardAllowed } from './access.ts';
import type { Member } from './store.ts';

export function safeLoanDestination(value: unknown, member: Pick<Member, 'role' | 'status' | 'office' | 'profileStatus'>): string | undefined {
    if (typeof value !== 'string' || value.startsWith('//')) return;
    if (administrativeAccess(member) && safeAdminPath(value)) return value;
    if (memberDashboardAllowed(member) && (safePortalPath(value) || /^\/portal\?loan=[A-Za-z0-9_-]+$/.test(value))) return value;
}
