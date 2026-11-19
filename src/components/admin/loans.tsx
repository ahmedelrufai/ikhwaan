'use client';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { ArrowUpRight, CheckCircle2, ChevronRight, Clock3, FilterX, HandCoins, Search, Settings2, Wallet, X } from 'lucide-react';
import { useAdminWorkspace, money } from './admin-context';
import { LOAN_STATUSES } from '@/lib/loan-validation';
const appliedDate = (value: string) => new Date(value).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' });
export default function LoansPage() {
    const { data, memberName, pendingLoans, loanPage, loans, pagination, statusFilter, setStatusFilter, search, setSearch } = useAdminWorkspace();
    const router = useRouter();
    const filtered = !!search || statusFilter !== 'All';
    const clearFilters = () => { setSearch(''); setStatusFilter('All'); };
    const summary = data.loanSummary;
    const stages = [
        { title: 'To review', value: summary?.review ?? pendingLoans.length, filter: 'Review queue', note: 'Applications awaiting a decision', icon: Clock3, tone: 'amber' },
        { title: 'Approved', value: summary?.approved ?? data.loans.filter(l => l.status === 'Approved').length, filter: 'Approved', note: 'Ready for repayment offers', icon: CheckCircle2, tone: 'green' },
        { title: 'To disburse', value: summary?.awaitingDisbursement ?? data.loans.filter(l => l.status === 'Awaiting Disbursement').length, filter: 'Awaiting Disbursement', note: 'Offer acceptance & transfer checks', icon: HandCoins, tone: 'blue' },
        { title: 'In repayment', value: summary?.repaying ?? data.loans.filter(l => ['Disbursed', 'Repaying'].includes(l.status)).length, filter: 'Active repayments', note: 'Disbursed loans being repaid', icon: Wallet, tone: 'purple' },
    ];
    const totals = [
        { label: 'Total requested', value: summary?.requested ?? data.loans.reduce((sum, l) => sum + l.amount, 0) },
        { label: 'Total approved', value: summary?.approvedAmount ?? data.loans.filter(l => l.terms).reduce((sum, l) => sum + (l.terms?.approvedAmount || 0), 0) },
        { label: 'Total disbursed', value: summary?.disbursed ?? data.loans.filter(l => ['Disbursed', 'Repaying', 'Completed'].includes(l.status)).reduce((sum, l) => sum + (l.terms?.approvedAmount || l.amount), 0) },
        { label: 'Outstanding', value: summary?.outstanding ?? data.members.reduce((sum, m) => sum + m.outstanding, 0) },
        { label: 'Overdue', value: summary?.overdue ?? data.loans.reduce((sum, l) => sum + (l.overdue || 0), 0) },
    ];
    return <div className="admin-loans-page">
        <div className="loan-register-intro"><p>Review requests, prepare offers and follow each loan through repayment.</p><Link className="button secondary" href="/admin/loans/settings"><Settings2 size={15}/>Loan settings<ArrowUpRight size={14}/></Link></div>
        <div className="loan-stage-cards" aria-label="Filter applications by stage">
            {stages.map(({ title, value, filter, note, icon: Icon, tone }) => <button key={filter} type="button" className={'loan-stage-card ' + tone + (statusFilter === filter ? ' selected' : '')} aria-pressed={statusFilter === filter} onClick={() => setStatusFilter(statusFilter === filter ? 'All' : filter)}><div className="loan-stage-card-top"><span>{title}</span><span className="loan-stage-icon"><Icon size={18}/></span></div><strong>{value}</strong><div className="loan-stage-card-bottom"><span>{note}</span><ChevronRight size={15}/></div></button>)}
        </div>
        <section className="panel loan-register-portfolio" aria-labelledby="loan-portfolio-title">
            <header className="loan-register-portfolio-title"><span className="loan-portfolio-icon"><Wallet size={20}/></span><div><h2 id="loan-portfolio-title">Loan portfolio</h2><p>A financial overview across all applications.</p></div><span className="loan-portfolio-scope">All loan records</span></header>
            <dl>{totals.map(({ label, value }) => <div key={label} className={'loan-portfolio-metric' + (label === 'Outstanding' ? ' is-outstanding' : label === 'Overdue' ? ' is-overdue' : '')}><dt>{label}</dt><dd>{money(value)}</dd><span className="loan-portfolio-caption">{label === 'Total requested' ? 'Application amounts' : label === 'Total approved' ? 'Recorded principal offers' : label === 'Total disbursed' ? 'Principal transferred' : label === 'Outstanding' ? 'Remaining member balances' : 'Past-due repayments'}</span></div>)}</dl>
        </section>
        <section className="panel loan-register" aria-labelledby="loan-register-title">
            <header className="loan-register-heading"><div><h2 id="loan-register-title">Loan applications <span>{summary?.total ?? data.loans.length}</span></h2><p>Open an application to review its details and next action.</p></div><span className="loan-register-live"><i/>Current records</span></header>
            <div className="loan-register-filters"><label className="loan-register-search"><Search size={17}/><span className="sr-only">Search loans by member or reference</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member, reference or reason…"/>{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><X size={15}/></button>}</label><label className="loan-register-select"><span>Status</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="All">All statuses</option><option>Review queue</option><option>Active repayments</option>{LOAN_STATUSES.filter(s => s !== 'Draft').map(status => <option key={status}>{status}</option>)}</select></label></div>
            <div className="loan-register-results"><span aria-live="polite">{data.pageMeta?.total ?? loans.length} {(data.pageMeta?.total ?? loans.length) === 1 ? 'application' : 'applications'}{filtered ? ' found' : ' in total'}</span>{filtered && <button type="button" onClick={clearFilters}><FilterX size={14}/>Clear filters</button>}</div>
            {loans.length ? <div className="table-scroll"><table className="loan-register-table"><caption className="sr-only">Member loan applications, amounts, submission dates and review statuses</caption><thead><tr><th>Member / reference</th><th>Requested amount</th><th>Applied</th><th>Queue</th><th>Status</th><th><span className="sr-only">Open application</span></th></tr></thead><tbody>{loanPage.items.map(loan => {
                const name = memberName(loan.memberId);
                const href = '/admin/loans/' + encodeURIComponent(loan.id);
                const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('');
                return <tr key={loan.id} onClick={event => { if (!(event.target as HTMLElement).closest('a,button')) router.push(href); }}><td className="loan-register-member"><div className="loan-register-person"><span className="loan-register-avatar" aria-hidden="true">{initials}</span><div><Link href={href}>{name}</Link><span className="loan-register-reference">{loan.reference || loan.id}</span><span className="loan-register-reason" title={loan.reason}>{loan.reason || 'Emergency loan application'}</span></div></div></td><td data-label="Requested" className="loan-register-amount">{money(loan.amount)}{loan.terms && loan.terms.approvedAmount !== loan.amount && <small>Approved {money(loan.terms.approvedAmount)}</small>}</td><td data-label="Applied"><time dateTime={loan.submittedAt || loan.createdAt}>{appliedDate(loan.submittedAt || loan.createdAt)}</time></td><td data-label="Queue"><span className="loan-register-queue">#{String(loan.queue).padStart(2, '0')}</span></td><td data-label="Status"><span className={'member-status status-' + loan.status.toLowerCase().replace(/ /g, '-')}><i/>{loan.status}</span>{loan.queueClosed && <small className="loan-register-closed">Queue closed</small>}</td><td className="loan-register-open"><Link href={href} aria-label={'Open loan ' + (loan.reference || loan.id) + ' for ' + name}>View<ChevronRight size={15}/></Link></td></tr>;
            })}</tbody></table></div> : <div className="loan-register-empty"><span>{filtered ? <FilterX size={25}/> : <HandCoins size={25}/>}</span><h3>{filtered ? 'No matching applications' : 'No loan applications yet'}</h3><p>{filtered ? 'Try a different member, reference or status.' : 'Submitted member applications will appear here for review.'}</p>{filtered && <button className="button secondary" type="button" onClick={clearFilters}>Show all applications</button>}</div>}
            {loans.length > 0 && pagination(loanPage, 'Loan pages')}
        </section>

    </div>;
}
