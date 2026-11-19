'use client';
import { usePathname } from 'next/navigation';
import WorkspaceFrame from '@/components/workspace-frame';
import WorkspaceSkeleton from '@/components/workspace-skeleton';
import { adminPageTitle } from '@/lib/admin-routes';
import { portalPageTitle } from '@/lib/portal-routes';
export default function Loading() {
    const pathname = usePathname();
    if (pathname.startsWith('/admin') && pathname !== '/admin/login') return <WorkspaceFrame kind="admin" title={adminPageTitle(pathname)}><WorkspaceSkeleton/></WorkspaceFrame>;
    if (pathname === '/portal' || pathname.startsWith('/portal/')) return <WorkspaceFrame kind="member" title={portalPageTitle(pathname)}><WorkspaceSkeleton/></WorkspaceFrame>;
    return <div className="public-page-skeleton"><WorkspaceSkeleton variant="form"/></div>;
}
