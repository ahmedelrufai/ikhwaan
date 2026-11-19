import { requireAdministrator } from '@/lib/admin-auth';
import Section from '@/components/admin/loan-settings';
export const metadata = { title: 'Loan settings · Administration · Ikhwaan' };
export default async function Page() {
    await requireAdministrator('/admin/loans/settings');
    return <Section/>;
}
