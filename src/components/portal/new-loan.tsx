'use client';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import LoanApplicationForm from '@/components/loan-application-form';
import { useMemberPortal } from './portal-context';
export default function NewLoanPage({ draftId }: { draftId?: string }) {
    const { data, member, contributions, hasActiveApplication, error, action } = useMemberPortal();
    const router = useRouter();
    const draft = draftId ? data.loans.find(loan => loan.id === draftId && loan.status === 'Draft') : data.loans.find(loan => loan.status === 'Draft' && !(loan as typeof loan & { queueClosed?: boolean }).queueClosed);
    if (hasActiveApplication) return <section className="panel portal-form-page"><h2>You already have an open application</h2><p>Track your existing application before starting another.</p><Link className="button primary" href="/portal/loans">View my loans</Link></section>;
    if (!member.bankAccount) return <section className="panel portal-form-page"><h2>Add your disbursement account</h2><p>Save the bank account you want the cooperative to use before applying.</p><Link className="button primary" href="/portal/bank-account/add?returnTo=loan">Add bank account & continue</Link></section>;
    if (draftId && !draft) return <section className="panel portal-form-page"><h2>Draft unavailable</h2><p>This draft may already have been submitted or closed.</p><Link href="/portal/loans">Back to my loans</Link></section>;
    return <section className="panel portal-form-page"><Link className="text-button" href="/portal/loans">← Back to my loans</Link><LoanApplicationForm key={draft?.id || 'new'} member={member} contributions={contributions} history={data.transactions} draft={draft || null} documentRequired={data.loanPolicy.documentRequired} error={error} onAction={async payload => { const saved = await action(payload); if (saved) router.push('/portal/loans'); return saved; }}/></section>;
}
