import { requireAdministrator } from '@/lib/admin-auth';
import Section from '@/components/admin/audit';
export const metadata = { title: 'Audit · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/audit');
    return <Section/>;
}
