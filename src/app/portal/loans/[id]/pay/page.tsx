import { notFound } from 'next/navigation';
import { requirePortalMember } from '@/lib/portal-auth';
import { withState } from '@/lib/store';
import LoanPayment from '@/components/portal/loan-payment';
export const metadata = { title: 'Make loan payment · Ikhwaan' };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ payment_reference?: string }> }) {
    const { id } = await params;
    const { payment_reference: reference } = await searchParams;
    const destination = '/portal/loans/' + encodeURIComponent(id) + '/pay' + (reference ? '?payment_reference=' + encodeURIComponent(reference) : '');
    const member = await requirePortalMember(destination);
    const exists = await withState(state => state.loans.some(loan => loan.id === id && loan.memberId === member.id), false, ['loans']);
    if (!exists) notFound();
    return <LoanPayment key={id} loanId={id}/>;
}
