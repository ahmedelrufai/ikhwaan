'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, CreditCard, ShieldCheck } from 'lucide-react';
import { ActionButton, ActionForm } from '@/components/action-feedback';
import { loanRepaymentBalance } from '@/lib/loan-interest';
import { installmentProgress } from '@/lib/repayment-dates';
import { useMemberPortal, money, date } from './portal-context';
export default function LoanPaymentPage({ loanId }: { loanId: string }) {
    const { data, busy, verifyPayment } = useMemberPortal();
    const loan = data.loans.find(loan => loan.id === loanId);
    const balance = loan ? loanRepaymentBalance(loan) : 0;
    const next = loan ? installmentProgress(loan).find(installment => installment.outstanding > 0) : undefined;
    const [amount, setAmount] = useState(((next?.outstanding || balance) / 100).toFixed(2));
    const [opening, setOpening] = useState(false);
    const [uncertainReference, setUncertainReference] = useState('');
    if (!loan) return <section className="panel portal-form-page"><h2>Loan unavailable</h2><Link href="/portal/loans">Back to your loans</Link></section>;
    const payments = data.payments.filter(payment => payment.purpose === 'Loan repayment' && payment.loanId === loanId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const pending = payments.find(payment => payment.status === 'Pending');
    const review = payments.find(payment => payment.reconciliationStatus === 'Needs review');
    const validCheckout = (value?: string) => { try { const url = new URL(value || ''); return url.protocol === 'https:' && url.hostname === 'checkout.paystack.com'; } catch { return false; } };
    return <section className="panel portal-form-page loan-payment-page"><Link className="text-button" href={'/portal/loans/' + encodeURIComponent(loanId)}>← Loan details</Link><h2>Make a loan payment</h2><p>{loan.reference || loan.id} · Pay securely with Paystack.</p><div className="loan-payment-summary"><CreditCard size={24}/><div><span>Outstanding balance</span><strong>{money(balance)}</strong></div></div>
        {review ? <p className="error" role="status">{review.reconciliationNote} Contact the cooperative with reference {review.reference}. Please wait for their review before making another payment.</p> : pending || uncertainReference ? <div className="loan-payment-pending"><h3>Finish your pending payment</h3><p>{pending ? money(pending.amount) + ' · ' + pending.reference : uncertainReference}</p><p>{pending && pending.amount > balance ? 'Your balance has changed. Verify this payment or contact the cooperative before paying again.' : 'Complete the existing checkout or verify its status before starting another payment.'}</p><div className="admin-actions">{validCheckout(pending?.checkoutUrl) && pending!.amount <= balance && balance > 0 && <a className="button primary" href={pending!.checkoutUrl}>Continue Paystack checkout<ArrowRight size={15}/></a>}<ActionButton className="button secondary" disabled={busy} onAction={() => verifyPayment(pending?.reference || uncertainReference)}>Verify payment</ActionButton></div></div> : balance <= 0 ? <p className="loan-payment-message">{['Completed', 'Repaid'].includes(loan.status) ? 'This loan is fully repaid. Thank you.' : 'Payments are available once your loan has been disbursed.'}</p> : !data.loanRepaymentsEnabled ? <p className="loan-payment-message">Online payments are not open yet. Contact the cooperative to arrange your repayment.</p> : <ActionForm onSubmit={async event => {
            event.preventDefault(); setOpening(true);
            try {
                const response = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'initialize-loan', loanId, amount }) });
                const result = await response.json();
                if (!response.ok) { if (result.reference) setUncertainReference(result.reference); throw new Error(result.error || 'Unable to start payment.'); }
                if (!validCheckout(result.url)) throw new Error('Unexpected payment checkout address.');
                window.location.assign(result.url);
            } finally { setOpening(false); }
        }}><label>Amount to pay (NGN)<input name="amount" type="number" inputMode="decimal" min="0.01" max={balance / 100} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required/><small>Pay any amount up to your outstanding balance.{next ? ' Next installment: ' + money(next.outstanding) + ' due ' + date(next.dueDate) + '.' : ''}</small></label><button type="button" className="text-button" onClick={() => setAmount((balance / 100).toFixed(2))}>Pay remaining balance</button><p className="loan-payment-security"><ShieldCheck size={16}/>Your loan balance updates after Paystack confirms your payment.</p><button className="button primary" disabled={opening || busy}>{opening ? 'Opening Paystack…' : 'Continue to Paystack'}<ArrowRight size={16}/></button></ActionForm>}
        {payments.length > 0 && <div className="loan-payment-history"><h3>Online payments for this loan</h3>{payments.map(payment => <article key={payment.id}><div><strong>{money(payment.amount)}</strong><small>{date(payment.createdAt)} · {payment.reference}</small><span className="badge">{payment.reconciliationStatus === 'Needs review' ? 'Needs review' : payment.status}</span></div>{payment.status !== 'Successful' && <ActionButton className="text-button" disabled={busy} onAction={() => verifyPayment(payment.reference)}>Verify</ActionButton>}</article>)}</div>}
    </section>;
}
