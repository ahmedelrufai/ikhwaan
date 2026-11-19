'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CreditCard, Info, Settings2, ShieldCheck, Wallet } from 'lucide-react';
import { ActionForm } from '@/components/action-feedback';
import { useAdminWorkspace, money } from './admin-context';
export default function PaymentSettingsPage() {
    const { data, busy, mutate } = useAdminWorkspace();
    const router = useRouter();
    const savedAmount = data.paymentSettings?.membershipFee ? (data.paymentSettings.membershipFee / 100).toFixed(2) : '';
    const savedEnabled = !!data.paymentSettings?.enabled;
    const [amount, setAmount] = useState(savedAmount);
    const [enabled, setEnabled] = useState(savedEnabled);
    const dirty = amount !== savedAmount || enabled !== savedEnabled;
    const validAmount = /^\d{1,9}(\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
    const previewAmount = validAmount ? money(Math.round(Number(amount) * 100)) : '—';
    const ready = enabled && data.paymentProviderConfigured;
    return <div className="payment-settings-page">
        <div className="payment-settings-intro"><Link href="/admin/payments"><ArrowLeft size={15}/>Back to payments</Link><p>Manage the membership fee and when members can pay online.</p></div>
        <div className="payment-settings-layout">
            <section className="panel payment-settings-editor" aria-labelledby="payment-settings-title">
                <header className="payment-settings-heading"><span><Settings2 size={21}/></span><div><h2 id="payment-settings-title">Payment preferences</h2><p>Set your fee and collection preferences in one place.</p></div></header>
                <ActionForm className="payment-settings-form" onSubmit={async event => { event.preventDefault(); await mutate({ action: 'payment-settings', amount, enabled }); router.push('/admin/payments'); }}>
                    <section className="payment-settings-section"><div className="payment-settings-section-title"><span>01</span><div><h3>Membership fee</h3><p>The amount a member pays for their membership.</p></div></div><label htmlFor="membership-fee-amount" className="payment-settings-field-label">Fee amount</label><div className="payment-settings-amount"><span aria-hidden="true">₦</span><input id="membership-fee-amount" name="amount" type="number" inputMode="decimal" min="0.01" max="999999999.99" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" aria-describedby="membership-fee-help"/><span className="payment-settings-currency">NGN</span></div><p id="membership-fee-help" className="payment-settings-help">Use the committee-approved amount in Nigerian naira. Loan repayments are calculated separately.</p></section>
                    <section className="payment-settings-section"><div className="payment-settings-section-title"><span>02</span><div><h3>Online collection</h3><p>Choose when members can start a Paystack checkout.</p></div></div><div className={'payment-settings-toggle-row' + (enabled ? ' enabled' : '')}><div><label htmlFor="accept-online-payments">Accept online payments</label><p id="collection-toggle-help">Applies to membership fees and loan repayments.</p></div><label className="payment-settings-switch"><span className="sr-only">Accept online payments</span><input id="accept-online-payments" name="enabled" type="checkbox" role="switch" checked={enabled} onChange={event => setEnabled(event.target.checked)} aria-describedby="collection-toggle-help"/><span className="payment-settings-switch-track" aria-hidden="true"/></label></div><div className="payment-settings-collection-note"><Info size={15}/><p>{enabled ? 'Members can start new payments once Paystack is configured. Changes take effect when you save.' : 'New checkouts will be paused. Existing payments can still be verified and reviewed.'}</p></div></section>
                    <div className="payment-settings-draft"><span><i className={dirty ? 'unsaved' : ''}/>{dirty ? 'You have unsaved changes' : 'Showing saved preferences'}</span>{dirty && <button type="button" onClick={() => { setAmount(savedAmount); setEnabled(savedEnabled); }}>Reset changes</button>}</div>
                    <button className="button primary" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save payment settings'}<Check size={16}/></button>
                </ActionForm>
            </section>
            <aside className="payment-settings-aside" aria-label="Payment provider and member preview">
                <section className="panel payment-provider-card"><div className="payment-provider-heading"><span><CreditCard size={22}/></span><div><span className="payment-settings-eyebrow">PAYMENT PROVIDER</span><h2>Paystack</h2></div></div><span className={'payment-provider-status' + (data.paymentProviderConfigured ? ' configured' : '')}><i/>{data.paymentProviderConfigured ? 'Configured' : 'Setup required'}</span><p>{data.paymentProviderConfigured ? 'Members are redirected to Paystack to complete their payment securely.' : 'Paystack needs to be configured before members can complete online payments.'}</p><div className="payment-provider-footnote"><ShieldCheck size={15}/><span>Provider credentials stay on the server.</span></div></section>
                <section className="panel payment-settings-preview"><div className="payment-settings-preview-heading"><Wallet size={17}/><h2>Member preview</h2></div><span className="payment-settings-preview-label">Membership fee</span><strong className="payment-settings-preview-amount">{previewAmount}</strong><p>The fee members will see at checkout.</p><div className={'payment-settings-preview-status' + (ready ? ' open' : '')}><CheckCircle2 size={15}/><span>{ready ? 'Online collection enabled' : !data.paymentProviderConfigured ? 'Awaiting Paystack setup' : 'Online collection paused'}</span></div><small>Preview reflects the fields on this page. Save to apply your changes.</small></section>
                <div className="payment-settings-guidance"><ShieldCheck size={18}/><p>Successful payments and repayment history remain available when collection is paused.</p></div>
                <Link className="payment-settings-history" href="/admin/payments">View payment activity<ArrowRight size={15}/></Link>
            </aside>
        </div>
    </div>;
}
