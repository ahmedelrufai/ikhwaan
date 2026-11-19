import { requireAdministrator } from '@/lib/admin-auth';
import Form from '@/components/admin/payment-settings';
export const metadata = { title: 'Payment settings · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/payments/settings');
    return <Form/>;
}
