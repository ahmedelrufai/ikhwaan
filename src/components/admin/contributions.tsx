'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { ArrowLeft, ArrowRight, Check, Info, Plus } from 'lucide-react';
import { ActionForm } from '@/components/action-feedback';
import { useAdminWorkspace, money } from './admin-context';

export default function ContributionsPage() {
    const { data } = useAdminWorkspace();
    return <div className="contribution-page"><div className="panel-heading"><div><h2>Contributions & events</h2><p>Manage individual funds, events and recurring contributions.</p></div><Link className="button primary" href="/admin/contributions/new"><Plus size={16}/>Create contribution</Link></div><div className="contribution-cards">{(data.contributionPlans || []).map(plan => {
        const paid = (data.payments || []).filter(p => p.purpose === 'Contribution' && (p.contributionId === plan.id || plan.id === 'legacy-general' && !p.contributionId) && p.status === 'Successful' && p.reconciliationStatus !== 'Needs review');
        return <article className="panel contribution-card" key={plan.id}><div className="panel-heading"><h2>{plan.title}</h2><span className="badge">{plan.active ? 'Open' : 'Paused'}</span></div><p>{plan.description || 'Cooperative contribution'}</p><strong className="balance-payment-amount">{money(plan.amount)}</strong><p>{plan.frequency === 'Once' ? 'One-time payment per member' : plan.frequency + ' · one payment per period'} · Starts {plan.startsOn}</p><dl className="contribution-totals"><div><dt>Total received</dt><dd>{money(paid.reduce((sum, p) => sum + p.amount, 0))}</dd></div><div><dt>Payments</dt><dd>{paid.length}</dd></div></dl><Link className="button secondary" href={'/admin/contributions/' + encodeURIComponent(plan.id) + '/edit'}>Manage contribution <ArrowRight size={16}/></Link></article>;
    })}</div>{!data.contributionPlans?.length && <section className="panel empty">No contributions yet. Create a fund or event to start collecting payments.</section>}</div>;
}
export function ContributionForm({ id }: { id?: string }) {
    const { data, mutate, busy } = useAdminWorkspace();
    const router = useRouter();
    const plan = data.contributionPlans?.find(p => p.id === id);
    const [frequency, setFrequency] = useState(plan?.frequency || 'Once');
    const [title, setTitle] = useState(plan?.title || '');
    const [description, setDescription] = useState(plan?.description || '');
    const [amount, setAmount] = useState(plan ? (plan.amount / 100).toFixed(2) : '');
    const [active, setActive] = useState(plan?.active ?? true);
    const [startsOn, setStartsOn] = useState(plan?.startsOn || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit' }).format(new Date()));
    const hasPayments = !!plan && (data.payments || []).some(p => p.contributionId === plan.id || plan.id === 'legacy-general' && p.purpose === 'Contribution' && !p.contributionId);
    const displayedAmount = /^\d{1,9}(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 ? money(Math.round(Number(amount) * 100)) : '₦0.00';
    if (id && !plan) return <section className="panel"><h2>Contribution not found</h2><Link href="/admin/contributions">Back to contributions</Link></section>;
    return <div className="contribution-builder">
        <Link className="contribution-back" href="/admin/contributions"><ArrowLeft size={16}/>All contributions</Link>
        <section className="panel contribution-editor" aria-labelledby="contribution-editor-title">
            <header className="contribution-editor-heading"><h2 id="contribution-editor-title">Set up your contribution</h2><p>Give members a clear purpose, amount and payment schedule.</p></header>
            <ActionForm className="contribution-builder-form" onSubmit={async event => { event.preventDefault(); await mutate({ action: 'contribution-save', ...(id ? { id } : {}), title, description, amount, frequency: hasPayments ? plan!.frequency : frequency, startsOn: hasPayments ? plan!.startsOn : startsOn, active }); router.push('/admin/contributions'); }}>
                <section className="contribution-form-section"><div className="contribution-section-heading"><h3>Basic details</h3><p>What are members contributing towards?</p></div><div className="contribution-section-fields">
                    <label>Contribution name<input name="title" required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Annual family gathering"/></label>
                    <label>Description <span className="contribution-optional">(optional)</span><textarea name="description" rows={3} maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Add a short description for members"/></label>
                </div></section>
                <section className="contribution-form-section"><div className="contribution-section-heading"><h3>Payment details</h3><p>Set the amount and how often it is paid.</p></div><div className="contribution-section-fields">
                    <fieldset className="contribution-frequency" disabled={hasPayments}><legend>How often should members pay?</legend><div>{(['Once', 'Monthly', 'Quarterly', 'Yearly'] as const).map(option => <label key={option} className={frequency === option ? 'selected' : ''}><input type="radio" name="frequency" value={option} checked={frequency === option} onChange={() => setFrequency(option)}/><span>{option === 'Once' ? 'One-time' : option}</span></label>)}</div></fieldset>
                    <div className="contribution-schedule-grid"><label>Amount per member<div className="contribution-currency-input"><span aria-hidden="true">₦</span><input aria-label="Amount per member in Nigerian naira" name="amount" type="number" inputMode="decimal" min="0.01" max="999999999.99" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00"/><span>NGN</span></div></label><label>Start month<input type="month" name="startsOn" min="2000-01" max="2099-12" required value={startsOn} onChange={event => setStartsOn(event.target.value)} disabled={hasPayments}/></label></div>
                    <div className="contribution-inline-note"><Info size={15}/><p>{hasPayments ? 'The schedule is locked because payments have started. You can still update the amount for new checkouts.' : frequency === 'Once' ? 'Each member makes one payment for this contribution.' : 'Members choose the period they are paying for. There are no automatic deductions.'}</p></div>
                </div></section>
                <section className="contribution-form-section"><div className="contribution-section-heading"><h3>Availability</h3><p>Control when members can pay.</p></div><div className="contribution-section-fields"><div className="contribution-availability"><div><h3>Accept payments</h3><p>{active ? 'Available to members from the start month.' : 'New payments are paused until you turn this on.'}</p></div><label className="payment-settings-switch"><span className="sr-only">Open for member payments</span><input name="active" type="checkbox" role="switch" checked={active} onChange={event => setActive(event.target.checked)}/><span className="payment-settings-switch-track" aria-hidden="true"/></label></div></div></section>
                <div className="contribution-save-summary"><span>{active ? 'Open for payments' : 'Payments paused'}</span><strong>{displayedAmount}<span> / {frequency === 'Once' ? 'member' : frequency === 'Monthly' ? 'month' : frequency === 'Quarterly' ? 'quarter' : 'year'}</span></strong></div>
                <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving…' : plan ? 'Save changes' : 'Create contribution'}<Check size={16}/></button>
                <button className="button secondary" disabled={busy} onClick={event => { event.preventDefault(); router.push('/admin/contributions'); }}>Cancel</button>
            </ActionForm>
        </section>
    </div>;
}
