'use client';
import Link from 'next/link';
import type { ContributionPlan } from '@/lib/store';
import { contributionPeriods } from '@/lib/contribution-periods';
import { useState } from 'react';
import { useMemberPortal, money } from './portal-context';
import { ArrowDownToLine, ArrowRight, CreditCard, Search, Users, Wallet } from 'lucide-react';
import { ActionButton, ActionForm } from '@/components/action-feedback';
export default function SavingsPage() {
    const { data, savings, contributions, search, setSearch, transactionTable, busy } = useMemberPortal();
    const [deposit, setDeposit] = useState('');
    const [opening, setOpening] = useState(false);
    const disabled = busy || opening || !data.balancePaymentsEnabled;
    async function checkout(purpose: 'contribution' | 'savings', contributionId?: string, period?: string) {
        setOpening(true);
        try {
            const response = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'initialize-' + purpose, ...(purpose === 'savings' ? { amount: deposit } : { contributionId, period }) }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to start payment.');
            window.location.assign(result.url);
        } finally { setOpening(false); }
    }
    const pending = data.payments.filter(p => ['Savings', 'Contribution'].includes(p.purpose || '') && (p.status === 'Pending' || p.reconciliationStatus === 'Needs review'));
    return <div className="member-balances-page">
        <div className="member-balance-summary"><article className="member-balance-card"><span className="member-balance-icon"><Wallet size={20}/></span><div><span>Special savings</span><h2>{money(savings)}</h2><p>Your recorded savings deposits</p></div></article><article className="member-balance-card"><span className="member-balance-icon"><Users size={20}/></span><div><span>Total contributions</span><h2>{money(contributions)}</h2><p>Across your funds and events</p></div></article></div>
        <section className="panel member-deposit-panel"><div className="member-deposit-heading"><h2>Add to your savings</h2><p>Choose an amount and pay securely with Paystack.</p></div><ActionForm className="member-deposit-form" onSubmit={async event => { event.preventDefault(); await checkout('savings'); }}><label>Amount (NGN)<div className="member-deposit-input"><span aria-hidden="true">₦</span><input aria-label="Savings amount in Nigerian naira" type="number" inputMode="decimal" min="0.01" max="999999999.99" step="0.01" required value={deposit} onChange={event => setDeposit(event.target.value)} placeholder="0.00"/></div></label><button className="button primary" disabled={disabled}>Pay into savings <ArrowRight size={16}/></button></ActionForm></section>
        <section className="contribution-page"><div><h2>Contributions & events</h2><p className="form-hint">Choose a fund or event. For recurring contributions, choose the period you want to pay.</p></div><div className="contribution-cards">{data.contributionPlans.map(plan => <MemberContribution key={plan.id} plan={plan} disabled={disabled} onPay={(period) => checkout('contribution', plan.id, period)}/>)}</div>{!data.contributionPlans.length && <section className="panel empty">No contributions have been announced yet.</section>}</section>
        <p className="balance-payment-info"><CreditCard size={16}/>{data.balancePaymentsEnabled ? 'Secure checkout with Paystack. Your balance updates after payment verification.' : 'Online payments are currently paused or unavailable. Contact the cooperative for assistance.'}</p>
        {!!pending.length && <section className="panel member-pending-payments"><h2>Payments to check</h2><p>You have pending payments or payments that need review. Verify their status before paying again.</p><Link className="button secondary" href="/portal/payments">View and verify payments <ArrowRight size={16}/></Link></section>}
        <section className="panel member-statement"><div className="panel-heading"><h2>Your statement</h2><a className="button secondary" href="/api/portal?export=statement"><ArrowDownToLine size={16}/>Download CSV</a></div><label className="search-field"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions"/></label>{transactionTable}</section>
    </div>;
}

function MemberContribution({ plan, disabled, onPay }: { plan: ContributionPlan; disabled: boolean; onPay: (period: string) => Promise<void> }) {
    const { data } = useMemberPortal();
    const periods = contributionPeriods(plan);
    const [selected, setSelected] = useState(periods[0]?.value || '');
    const period = periods.some(p => p.value === selected) ? selected : periods[0]?.value || '';
    const same = data.payments.filter(p => p.purpose === 'Contribution' && (p.contributionId === plan.id && p.contributionPeriod === period || plan.id === 'legacy-general' && !p.contributionId));
    const paid = same.some(p => p.status === 'Successful');
    const review = same.some(p => p.reconciliationStatus === 'Needs review');
    const pending = same.some(p => p.status === 'Pending');
    return <article className="panel contribution-card"><div className="panel-heading"><h3>{plan.title}</h3><span className="badge">{plan.active ? plan.frequency === 'Once' ? 'One-time' : plan.frequency : 'Paused'}</span></div><p>{plan.description}</p><strong className="balance-payment-amount">{money(plan.amount)}</strong>{plan.frequency !== 'Once' && !!periods.length && <label>Payment period<select value={period} onChange={event => setSelected(event.target.value)}>{periods.map(option => <option key={option.value} value={option.value}>{option.label}{data.payments.some(p => p.memberId === data.member.id && p.contributionId === plan.id && p.contributionPeriod === option.value && p.status === 'Successful') ? ' · Paid' : ''}</option>)}</select></label>}<p className="form-hint">{review ? 'Payment received. Contact the cooperative for reconciliation.' : paid ? 'You have paid for this ' + (plan.frequency === 'Once' ? 'contribution.' : 'period.') : !periods.length ? 'Payments start in ' + plan.startsOn + '.' : plan.frequency === 'Once' ? 'One payment per member for this event or fund.' : 'One payment per calendar period. No automatic deductions.'}</p><ActionButton className="button primary" disabled={disabled || !plan.active || paid || !period || review} onAction={() => onPay(period)}>{review ? 'Needs review' : paid ? 'Paid' : !plan.active ? 'Collection paused' : pending ? 'Continue pending payment' : 'Pay contribution'}<ArrowRight size={16}/></ActionButton></article>;
}
