import type { ReactNode } from 'react';
import Portal from '@/components/member-portal';
export default function MemberPortalLayout({ children }: { children: ReactNode }) { return <Portal>{children}</Portal>; }
