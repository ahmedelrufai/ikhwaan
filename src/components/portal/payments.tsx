'use client';
import { useMemberPortal, money, date } from './portal-context';
import { ArrowRight, CreditCard } from 'lucide-react';
import { ActionButton } from '@/components/action-feedback';
export default function PaymentsPage() {
    const { data, busy, startPayment, verifyPayment } = useMemberPortal();
    const feePaid = data.payments.some(p => p.purpose !== 'Loan repayment' && p.status === 'Successful');
    return <>{!feePaid && <section className="panel"><h2>Your profile is approved</h2><p>Pay your application fee to continue to your dashboard.</p></section>}{feePaid && <a className="button primary" href="/portal">Continue to dashboard <ArrowRight size={16}/></a>}<section className="panel"><div className="panel-heading"><div><h2>Application fee · {money(data.membershipFee)}</h2><p>Pay securely with Paystack.</p></div>{data.paymentsEnabled && <ActionButton className="button primary" disabled={busy || data.payments.some(p => p.purpose !== 'Loan repayment' && p.status === 'Successful')} onAction={startPayment}>Pay application fee <ArrowRight size={16}/></ActionButton>}</div>{data.payments.map(p => <div className="record" key={p.id}><div><strong>{money(p.amount)} · {p.purpose || 'Membership fee'}</strong>{p.reconciliationNote && <p role="status">{p.reconciliationNote}</p>}<small>{p.reference} · {date(p.createdAt)}</small></div><div className="admin-actions"><span className="badge">{p.status}</span>{p.status !== 'Successful' && <ActionButton className="button secondary" disabled={busy} onAction={() => verifyPayment(p.reference)}>Verify</ActionButton>}</div></div>)}</section>
{!data.paymentsEnabled && <section className="panel setup-panel"><CreditCard size={42}/><h2>Application fee</h2><p>Online payments are currently unavailable. Contact the cooperative to complete your application fee payment.</p></section>}</>;
}
