import { notFound } from 'next/navigation';
import { requireAdministrator } from '@/lib/admin-auth';
import { withState } from '@/lib/store';
import Details from '@/components/admin/loan-details';
export const metadata = { title: 'Loans details · Administration · Ikhwaan' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    await requireAdministrator('/admin/loans/' + encodeURIComponent(id));
    const exists = await withState(state => state.loans.some(loan => loan.id === id && loan.status !== 'Draft'), false, ['loans']);
    if (!exists) notFound();
    return <Details/>;
}
