import { requireAdministrator } from '@/lib/admin-auth';
import Section from '@/components/admin/payments';
export const metadata = { title: 'Payments · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/payments');
    return <Section/>;
}
