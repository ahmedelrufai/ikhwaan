import { requireAdministrator } from '@/lib/admin-auth';
import Form from '@/components/admin/new-transaction';
export const metadata = { title: 'Record transaction · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/transactions/new');
    return <Form/>;
}
