import type { ReactNode } from 'react';
import AdminWorkspace from '@/components/admin-workspace';
export default function AdministrationLayout({ children }: { children: ReactNode }) { return <AdminWorkspace>{children}</AdminWorkspace>; }
