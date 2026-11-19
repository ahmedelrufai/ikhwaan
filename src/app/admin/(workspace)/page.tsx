import { redirect } from 'next/navigation';
import { requireAdministrator } from '@/lib/admin-auth';
import { adminHref } from '@/lib/admin-routes';
import Overview from '@/components/admin/overview';
export const metadata = { title: 'Administration · Ikhwaan' };
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
    const { view } = await searchParams;
    if (view && adminHref(view) !== '/admin') redirect(adminHref(view));
    await requireAdministrator('/admin');
    return <Overview/>;
}
