import { requireAdministrator } from '@/lib/admin-auth';
import Section from '@/components/admin/members';
export const metadata = { title: 'Members · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/members');
    return <Section/>;
}
