import { requireAdministrator } from '@/lib/admin-auth';
import Section from '@/components/admin/loans';
export const metadata = { title: 'Loans · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/loans');
    return <Section/>;
}
