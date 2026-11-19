import { notFound } from 'next/navigation';
import { requirePortalMember } from '@/lib/portal-auth';
import { withState } from '@/lib/store';
import LoanDetails from '@/components/portal/loan-details';
export const metadata = { title: 'Loan details · Ikhwaan' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const member = await requirePortalMember('/portal/loans/' + encodeURIComponent(id));
    const exists = await withState(state => state.loans.some(loan => loan.id === id && loan.memberId === member.id), false, ['loans']);
    if (!exists) notFound();
    return <LoanDetails loanId={id}/>;
}
