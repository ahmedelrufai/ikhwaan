import { requireAdministrator } from '@/lib/admin-auth';
import Section from '@/components/admin/withdrawals';
export const metadata = { title: 'Withdrawals · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/withdrawals');
    return <Section/>;
}
