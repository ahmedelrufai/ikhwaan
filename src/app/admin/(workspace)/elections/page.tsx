import { requireAdministrator } from '@/lib/admin-auth';
import Section from '@/components/admin/elections';
export const metadata = { title: 'Elections · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/elections');
    return <Section/>;
}
