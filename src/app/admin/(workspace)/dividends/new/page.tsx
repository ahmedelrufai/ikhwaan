import { requireAdministrator } from '@/lib/admin-auth';
import Form from '@/components/admin/new-dividend';
export const metadata = { title: 'Allocate dividend · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/dividends/new');
    return <Form/>;
}
