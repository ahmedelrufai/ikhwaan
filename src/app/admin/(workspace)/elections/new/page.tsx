import { requireAdministrator } from '@/lib/admin-auth';
import Form from '@/components/admin/new-election';
export const metadata = { title: 'Schedule ballot · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/elections/new');
    return <Form/>;
}
