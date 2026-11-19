'use client';
import Link from 'next/link';
import { useMemberPortal, money, date } from './portal-context';
import { ArrowRight, CheckCircle2, CreditCard } from 'lucide-react';
import { ActionButton } from '@/components/action-feedback';
export default function PaymentsPage() {
    const { data, busy, startPayment, verifyPayment } = useMemberPortal();
    const feePayment = data.payments.find(p => (!p.purpose || p.purpose === 'Membership fee') && p.status === 'Successful');
    const feePaid = !!feePayment;
    const payments = [...data.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return <div className="member-payments-page">
        <section className={'panel member-fee-card' + (feePaid ? ' is-paid' : '')}>
            <span className="member-fee-icon">{feePaid ? <CheckCircle2 size={24}/> : <CreditCard size={24}/>}</span>
            <div className="member-fee-copy"><h2>{feePaid ? 'Application fee paid' : 'Your profile is approved'}</h2><p>{feePaid ? 'Your application payment is complete. You can access your dashboard.' : 'Complete your application fee payment to access your dashboard.'}</p><strong>{money(feePayment?.amount ?? data.membershipFee)}<span> · Application fee</span></strong></div>
            {feePaid ? <Link className="button secondary" href="/portal">Go to dashboard <ArrowRight size={16}/></Link> : data.paymentsEnabled ? <ActionButton className="button primary" disabled={busy} onAction={startPayment}>Pay application fee <ArrowRight size={16}/></ActionButton> : <span className="badge">Collection unavailable</span>}
        </section>
        {!data.paymentsEnabled && !feePaid && <div className="member-payment-notice" role="status">Online payments are currently unavailable. Contact the cooperative to complete your application fee payment.</div>}
        <section className="panel member-payment-history"><header className="panel-heading"><div><h2>Payment history</h2><p>Application fees, savings, contributions and loan repayments.</p></div><span className="badge">{payments.length} payments</span></header>
            {payments.map(p => <div className="record" key={p.id}><div className="member-payment-identity"><strong>{p.contributionTitle || p.purpose || 'Application fee'}</strong>{p.contributionPeriod && <p>{p.contributionPeriod === 'once' ? 'One-time contribution' : 'Period: ' + p.contributionPeriod}</p>}<small className="member-payment-reference">{p.reference}</small><small>{date(p.createdAt)}</small>{p.reconciliationNote && <p role="status" className="member-payment-review">{p.reconciliationNote}</p>}</div><div className="member-payment-result"><strong>{money(p.amount)}</strong><span className={'payment-state ' + (p.reconciliationStatus === 'Needs review' ? 'review' : p.status.toLowerCase())}><i/>{p.reconciliationStatus === 'Needs review' ? 'Needs review' : p.status}</span>{(p.status !== 'Successful' || p.status === 'Successful' && (p.purpose === 'Savings' || p.purpose === 'Contribution') && !p.reconciliationStatus) && <ActionButton className="button secondary" disabled={busy} onAction={() => verifyPayment(p.reference)}>Verify payment</ActionButton>}</div></div>)}
            {!payments.length && <div className="empty"><CreditCard size={25}/><h3>No payments yet</h3><p>Your payment history will appear here after you start a payment.</p></div>}
        </section>
    </div>;
}
