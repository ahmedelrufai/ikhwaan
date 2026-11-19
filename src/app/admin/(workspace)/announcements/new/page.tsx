import { requireAdministrator } from '@/lib/admin-auth';
import Form from '@/components/admin/new-announcement';
export const metadata = { title: 'Publish announcement · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/announcements/new');
    return <Form/>;
}
