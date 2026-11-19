'use client';
import { useState, type FormEvent } from 'react';
import { ActionForm } from '@/components/action-feedback';
import { calculateLoanInterest } from '@/lib/loan-interest';
import { amountInKobo } from '@/lib/rules';
import { lagosDateKey } from '@/lib/repayment-dates';
import type { Loan } from '@/lib/store';
const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value / 100);
export default function LoanTermsForm({ loan, busy, onAction }: { loan: Loan; busy: boolean; onAction: (input: Record<string, unknown>) => Promise<void> }) {
    const [amount, setAmount] = useState(String(loan.amount / 100));
    const [rate, setRate] = useState('0');
    const [months, setMonths] = useState('1');
    let preview: ReturnType<typeof calculateLoanInterest> | undefined;
    try { preview = calculateLoanInterest(amountInKobo(amount), rate); } catch { /* Preview appears when inputs are valid. */ }
    const count = Number(months), validCount = Number.isInteger(count) && count >= 1 && count <= 120;
    const low = preview && validCount ? Math.floor(preview.totalRepayment / count) : 0;
    const high = preview && validCount ? Math.ceil(preview.totalRepayment / count) : 0;
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); await onAction({ ...Object.fromEntries(new FormData(event.currentTarget)), action: 'loan-terms', id: loan.id });
    }
    return <><div className="loan-case-action-title"><span className="loan-case-eyebrow">MANAGEMENT TERMS</span><h2>Set repayment terms</h2><p>Prepare the loan offer for the member to review and accept.</p></div><ActionForm className="loan-case-form" onSubmit={submit}>
        <label>Approved amount (NGN)<input name="approvedAmount" type="number" min="0.01" max={loan.amount / 100} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required/></label>
        <label>Interest rate (%)<input name="interestRate" type="number" min="0" max="100" step="0.01" value={rate} onChange={e => setRate(e.target.value)} required/><small>One-time flat interest on the approved amount.</small></label>
        <div className="loan-case-form-pair"><label>First due date<input name="firstDueDate" type="date" min={lagosDateKey()} defaultValue={loan.proposedRepaymentDate || ''} required/></label><label>Monthly installments<input name="installments" type="number" min="1" max="120" value={months} onChange={e => setMonths(e.target.value)} required/></label></div>
        {preview && validCount && <div className="loan-terms-preview"><span className="loan-case-eyebrow">OFFER SUMMARY</span><dl className="loan-offer-summary"><div><dt>Approved amount</dt><dd>{money(amountInKobo(amount))}</dd></div><div><dt>Interest ({preview.interestRate}%)</dt><dd>{money(preview.interestAmount)}</dd></div><div><dt>Monthly repayment</dt><dd>{low === high ? money(low) : `${money(low)} – ${money(high)}`}</dd></div><div className="loan-offer-total"><dt>Total repayment</dt><dd>{money(preview.totalRepayment)}</dd></div></dl>{low !== high && <small>Installments differ by one kobo to preserve the exact total.</small>}</div>}
        <label>Notes (optional)<textarea name="repaymentTerms" rows={2} maxLength={2000} placeholder="Additional conditions for the member"/><small>Notes do not add charges to the repayment schedule.</small></label>
        <button className="button primary" disabled={busy}>Save terms & send offer</button>
    </ActionForm></>;
}
