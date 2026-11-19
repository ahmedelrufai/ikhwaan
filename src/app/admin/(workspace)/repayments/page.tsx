import { requireAdministrator } from '@/lib/admin-auth';
import Section from '@/components/admin/repayments';
export const metadata = { title: 'Repayments · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/repayments');
    return <Section/>;
}
