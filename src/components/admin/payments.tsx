'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpRight, CheckCircle2, ChevronRight, Clock3, CreditCard, FilterX, Search, Settings2, Wallet, XCircle } from 'lucide-react';
import { useAdminWorkspace, money } from './admin-context';
import Pagination from '@/components/pagination';
import { paginate } from '@/lib/pagination';
const paymentDate = (value: string) => new Date(value).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' });
const paymentTime = (value: string) => new Date(value).toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' });
export default function PaymentsPage() {
    const { data, memberName } = useAdminWorkspace();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('All');
    const [purpose, setPurpose] = useState('All');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { setPage(1); }, [search, status, purpose, pageSize]);
    const payments = data.payments || [];
    const received = payments.filter(payment => payment.status === 'Successful');
    const pending = payments.filter(payment => payment.status === 'Pending');
    const failed = payments.filter(payment => payment.status === 'Failed');
    const review = payments.filter(payment => payment.reconciliationStatus === 'Needs review');
    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        const members = new Map(data.members.map(member => [member.id, member]));
        return payments.filter(payment => {
            const member = members.get(payment.memberId);
            const category = payment.purpose || 'Membership fee';
            const statusMatches = status === 'All' || (status === 'Needs review' ? payment.reconciliationStatus === 'Needs review' : payment.status === status);
            return statusMatches && (purpose === 'All' || purpose === category) && `${member?.name || ''} ${member?.number || ''} ${member?.email || ''} ${payment.reference} ${category} ${payment.status} ${payment.reconciliationStatus || ''}`.toLowerCase().includes(term);
        }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }, [payments, data.members, search, status, purpose]);
    const result = paginate(filtered, page, pageSize);
    const hasFilters = !!search || status !== 'All' || purpose !== 'All';
    const clear = () => { setSearch(''); setStatus('All'); setPurpose('All'); };
    const collectionsOpen = !!data.paymentSettings?.enabled && data.paymentProviderConfigured;
    const cards = [
        { label: 'Total received', value: money(received.reduce((sum, payment) => sum + payment.amount, 0)), note: `${received.length} successful ${received.length === 1 ? 'payment' : 'payments'}`, filter: 'Successful', icon: Wallet, tone: 'green' },
        { label: 'Pending', value: String(pending.length), note: 'Awaiting payment confirmation', filter: 'Pending', icon: Clock3, tone: 'amber' },
        { label: 'Failed', value: String(failed.length), note: 'Unsuccessful payment attempts', filter: 'Failed', icon: XCircle, tone: 'muted' },
        { label: 'Needs review', value: String(review.length), note: 'Received payments to reconcile', filter: 'Needs review', icon: AlertCircle, tone: 'rose' },
    ];
    return <div className="admin-payments-page">
        <div className="payment-page-intro"><p>Track membership fees, loan repayments and payments that need your attention.</p><Link className="button secondary" href="/admin/payments/settings"><Settings2 size={15}/>Payment settings<ArrowUpRight size={14}/></Link></div>
        <div className="payment-summary-cards" aria-label="Payment overview and status filters">{cards.map(({ label, value, note, filter, icon: Icon, tone }) => <button type="button" className={'payment-summary-card ' + tone + (status === filter ? ' selected' : '')} key={filter} aria-pressed={status === filter} onClick={() => setStatus(status === filter ? 'All' : filter)}><div className="payment-summary-top"><span>{label}</span><span className="payment-summary-icon"><Icon size={18}/></span></div><strong>{value}</strong><span className="payment-summary-note">{note}</span></button>)}</div>
        <section className="payment-collection-bar" aria-label="Payment collection settings"><span className="payment-collection-icon"><CreditCard size={19}/></span><div><strong>{collectionsOpen ? 'Online payments are open' : !data.paymentProviderConfigured ? 'Payment setup needed' : 'Online collection is paused'}</strong><span>{collectionsOpen ? 'Members can pay membership fees and repay loans with Paystack.' : !data.paymentProviderConfigured ? 'Configure Paystack to enable online payments.' : 'Existing payments remain available for tracking and verification.'}</span></div><div className="payment-membership-fee"><span>Membership fee</span><strong>{money(data.paymentSettings?.membershipFee || 0)}</strong></div><Link href="/admin/payments/settings" aria-label="Manage payment collection settings">Manage<ChevronRight size={15}/></Link></section>
        <section className="panel payment-register" aria-labelledby="payment-register-title"><header className="payment-register-heading"><div><h2 id="payment-register-title">Payment activity <span>{payments.length}</span></h2><p>A record of every online payment and its current status.</p></div><span className="payment-provider-label"><ShieldIcon/>Powered by Paystack</span></header>
            <div className="payment-register-toolbar"><label className="payment-search"><Search size={17}/><span className="sr-only">Search payments</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search member, email or reference…" maxLength={500}/></label><div className="payment-selects"><label><span className="sr-only">Filter by payment purpose</span><select value={purpose} onChange={event => setPurpose(event.target.value)}><option value="All">All payment types</option><option>Membership fee</option><option>Loan repayment</option></select></label><label><span className="sr-only">Filter by payment status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="All">All statuses</option><option>Successful</option><option>Pending</option><option>Failed</option><option>Needs review</option></select></label></div></div>
            <div className="payment-results"><span aria-live="polite">{filtered.length} {filtered.length === 1 ? 'payment' : 'payments'}{hasFilters ? ' found' : ' in total'}</span>{hasFilters && <button type="button" onClick={clear}><FilterX size={14}/>Clear filters</button>}</div>
            {filtered.length ? <div className="table-scroll"><table className="payment-register-table"><caption className="sr-only">Member payments with purpose, amount, reconciliation status and reference</caption><thead><tr><th scope="col">Member</th><th scope="col">Payment</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Date</th><th scope="col"><span className="sr-only">Related record</span></th></tr></thead><tbody>{result.items.map(payment => {
                const name = memberName(payment.memberId);
                const needsReview = payment.reconciliationStatus === 'Needs review';
                const category = payment.purpose || 'Membership fee';
                const member = data.members.find(member => member.id === payment.memberId);
                return <tr key={payment.id} className={needsReview ? 'payment-needs-review' : ''}><td className="payment-member-cell"><div className="payment-person"><span className="payment-avatar" aria-hidden="true">{name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</span><div><Link href={'/admin/members/' + encodeURIComponent(payment.memberId)}>{name}</Link><small>{member?.email || 'Member account'}</small></div></div></td><td className="payment-reference-cell" data-label="Payment"><span className={'payment-purpose ' + (category === 'Loan repayment' ? 'loan' : 'membership')}>{category === 'Loan repayment' ? <CreditCard size={12}/> : <CheckCircle2 size={12}/>}{category}</span><code title={payment.reference}>{payment.reference}</code></td><td className="payment-value" data-label="Amount">{money(payment.amount)}</td><td data-label="Status"><span className={'payment-state ' + (needsReview ? 'review' : payment.status.toLowerCase())}><i/>{needsReview ? 'Needs review' : payment.status}</span>{needsReview && <small className="payment-unapplied">Received · not applied to loan</small>}{payment.reconciliationNote && <details className="payment-review-note"><summary>Review note</summary><p>{payment.reconciliationNote}</p></details>}</td><td className="payment-date" data-label="Date"><time dateTime={payment.createdAt}>{paymentDate(payment.createdAt)}</time><small>{paymentTime(payment.createdAt)}</small></td><td className="payment-related"><Link href={payment.loanId ? '/admin/loans/' + encodeURIComponent(payment.loanId) : '/admin/members/' + encodeURIComponent(payment.memberId)}>{payment.loanId ? 'View loan' : 'View member'}<ChevronRight size={14}/></Link></td></tr>;
            })}</tbody></table></div> : <div className="payment-empty"><span>{hasFilters ? <FilterX size={27}/> : <CreditCard size={27}/>}</span><h3>{hasFilters ? 'No matching payments' : 'No payments yet'}</h3><p>{hasFilters ? 'Try another reference, member or payment status.' : 'Membership payments and online loan repayments will appear here.'}</p>{hasFilters && <button className="button secondary" type="button" onClick={clear}>Show all payments</button>}</div>}
            {filtered.length > 0 && <Pagination {...result} label="Payment pages" pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>}
        </section>
    </div>;
}
function ShieldIcon() { return <CheckCircle2 size={13}/>; }
