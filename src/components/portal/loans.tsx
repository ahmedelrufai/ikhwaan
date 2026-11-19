'use client';
import Link from 'next/link';
import { loanRepaymentBalance } from '@/lib/loan-interest';
import { ArrowUpRight, ChevronRight, HandCoins } from 'lucide-react';
import { useMemberPortal, money, date } from './portal-context';
export default function LoansPage() {
    const { data, hasActiveApplication, applyForLoan } = useMemberPortal();
    const loans = [...data.loans].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return <div className="member-loan-list-page">
        <div className="info-strip"><HandCoins size={23}/><div><strong>Your loans, in one place</strong><p>Select an application to view its offer, repayment schedule and history.</p></div>{!hasActiveApplication && <button className="button primary" onClick={() => applyForLoan()}>Apply for a loan<ArrowUpRight size={15}/></button>}</div>
        <section className="panel member-loan-directory" aria-labelledby="member-loan-list-title">
            <header className="panel-heading"><h2 id="member-loan-list-title">Your applications</h2><span className="subtle-pill">{loans.length} {loans.length === 1 ? 'application' : 'applications'}</span></header>
            {loans.length ? <ul className="member-loan-list">{loans.map(loan => <li key={loan.id} className="member-loan-entry"><Link className="member-loan-list-row" href={'/portal/loans/' + encodeURIComponent(loan.id)} aria-label={'View loan ' + (loan.reference || loan.id)}>
                <span className="member-loan-list-icon" aria-hidden="true"><HandCoins size={20}/></span>
                <div className="member-loan-list-identity"><strong>{loan.reference || 'Loan application'}</strong><span>{loan.reason || 'Draft application'}</span><small>{loan.status === 'Draft' ? 'Saved' : 'Applied'} {date(loan.submittedAt || loan.createdAt)}</small></div>
                <div className="member-loan-list-amount"><small>Requested amount</small><strong>{money(loan.amount)}</strong>{loanRepaymentBalance(loan) > 0 && <small className="member-loan-row-balance">Balance {money(loanRepaymentBalance(loan))}</small>}</div>
                <div className="member-loan-list-stage"><span className={'member-status status-' + loan.status.toLowerCase().replace(/ /g, '-')}><i/>{loan.status}</span><span className="member-loan-list-action">{loan.status === 'Awaiting Disbursement' && !loan.termsAcceptedAt ? 'Review offer' : 'View details'}<ChevronRight size={15}/></span></div>
            </Link>{loanRepaymentBalance(loan) > 0 && <div className="member-loan-entry-payment"><Link className="button primary" href={'/portal/loans/' + encodeURIComponent(loan.id) + '/pay'} aria-label={'Make a payment for loan ' + (loan.reference || loan.id)}>Make payment</Link></div>}</li>)}</ul> : <div className="member-loan-list-empty"><HandCoins size={32}/><h3>No applications yet</h3><p>Your loan applications will appear here after you start a request.</p></div>}
        </section>
    </div>;
}
