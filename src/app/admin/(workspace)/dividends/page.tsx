import { requireAdministrator } from '@/lib/admin-auth';
import Section from '@/components/admin/dividends';
export const metadata = { title: 'Dividends · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/dividends');
    return <Section/>;
}
