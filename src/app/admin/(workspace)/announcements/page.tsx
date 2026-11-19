import { requireAdministrator } from '@/lib/admin-auth';
import Section from '@/components/admin/announcements';
export const metadata = { title: 'Announcements · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/announcements');
    return <Section/>;
}
