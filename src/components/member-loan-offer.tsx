'use client';
import { ArrowRight, CalendarDays, Check, ChevronDown, ShieldCheck } from 'lucide-react';
import { ActionButton } from '@/components/action-feedback';
import { installmentProgress } from '@/lib/repayment-dates';
import type { Loan } from '@/lib/store';
const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value / 100);
function date(value: string) { return new Date(value.length === 10 ? value + 'T12:00:00+01:00' : value).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' }); }
export default function MemberLoanOffer({ loan, busy, onAction }: { loan: Loan; busy: boolean; onAction: (payload: Record<string, unknown>) => Promise<unknown> }) {
    const terms = loan.terms;
    if (!terms) return null;
    const installments = installmentProgress(loan);
    const amounts = installments.map(i => i.amount), low = Math.min(...amounts), high = Math.max(...amounts);
    const pending = loan.status === 'Awaiting Disbursement' && !loan.termsAcceptedAt;
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    return <section className="member-offer" aria-label="Loan repayment offer">
        <header className="member-offer-header"><div className="member-offer-title"><span className="member-offer-icon"><ShieldCheck size={20}/></span><div><span className="member-offer-eyebrow">YOUR LOAN OFFER</span><h3>Repayment terms</h3></div></div><span className={'member-offer-state' + (loan.termsAcceptedAt ? ' accepted' : '')}>{loan.termsAcceptedAt ? <><Check size={12}/>Accepted</> : loan.termsDeclinedAt ? 'Declined' : pending ? 'Awaiting your decision' : 'Saved terms'}</span></header>
        <div className="member-offer-body"><div className="member-offer-figures"><div className="member-offer-monthly"><span>Monthly repayment</span><strong>{amounts.length ? low === high ? money(low) : `${money(low)} – ${money(high)}` : 'Not recorded'}</strong><small>Across {amounts.length} monthly {amounts.length === 1 ? 'installment' : 'installments'}</small></div><dl className="member-offer-facts"><div><dt>Approved amount</dt><dd>{money(terms.approvedAmount)}</dd></div><div><dt>One-time interest · {terms.interestRate || 0}%</dt><dd>{money(terms.interestAmount || 0)}</dd></div><div><dt>First repayment</dt><dd>{installments[0] ? date(installments[0].dueDate) : 'Not recorded'}</dd></div><div className="member-offer-total"><dt>Total repayment</dt><dd>{money(total)}</dd></div></dl></div>
        {terms.repaymentTerms && <div className="member-offer-note"><span>MANAGEMENT NOTE</span><p>{terms.repaymentTerms}</p></div>}
        <details className="member-offer-schedule"><summary><span><CalendarDays size={15}/>Repayment schedule <small>{amounts.length} payments</small></span><ChevronDown size={16}/></summary><div className="member-offer-table-scroll"><table><thead><tr><th>Payment</th><th>Due date</th><th>Amount</th><th>Remaining</th><th>Status</th></tr></thead><tbody>{installments.map((i, index) => <tr key={i.dueDate}><td>{String(index + 1).padStart(2, '0')}</td><td>{date(i.dueDate)}</td><td>{money(i.amount)}</td><td>{money(i.outstanding)}</td><td><span className={'offer-payment-state ' + i.status.toLowerCase().replace(/ /g, '-')}>{i.status}</span></td></tr>)}</tbody></table></div></details>
        </div>
        {pending && <footer className="member-offer-footer"><p>Review these terms before accepting.<br/><span>Your acceptance is required before disbursement.</span></p><div className="member-offer-actions"><ActionButton className="button secondary" disabled={busy} confirm="Decline this offer and close the application?" onAction={() => onAction({ action: 'loan-decline-terms', id: loan.id })}>Decline offer</ActionButton><ActionButton className="button primary" disabled={busy} confirm="Accept these approved repayment terms?" onAction={() => onAction({ action: 'loan-accept-terms', id: loan.id, accepted: true })}>Accept offer<ArrowRight size={15}/></ActionButton></div></footer>}
        {loan.termsAcceptedAt && <footer className="member-offer-footer"><p><Check size={14}/>Terms accepted on {date(loan.termsAcceptedAt)}</p></footer>}
        {loan.termsDeclinedAt && <footer className="member-offer-footer"><p>Offer declined on {date(loan.termsDeclinedAt)}</p></footer>}
    </section>;
}
