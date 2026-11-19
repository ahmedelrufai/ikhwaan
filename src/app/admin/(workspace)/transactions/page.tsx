import { requireAdministrator } from '@/lib/admin-auth';
import Section from '@/components/admin/transactions';
export const metadata = { title: 'Transactions · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/transactions');
    return <Section/>;
}
