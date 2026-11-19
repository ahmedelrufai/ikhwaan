// Verify an existing successful balance payment before recovering its ledger entry.
// Dry-run by default. Never creates a charge or changes a stored payment amount.
import { withState } from '../src/lib/store.ts';
import { reconcilePayment, paymentNeedsLedgerCredit } from '../src/lib/payments.ts';
import { paystackRequest } from '../src/lib/paystack.ts';
const reference = process.argv[2];
const apply = process.argv.includes('--apply');
try {
    if (!/^ikh_[a-f0-9-]{36}$/.test(reference || '')) throw new Error('Supply an existing Paystack reference.');
    if (!process.env.PAYSTACK_SECRET_KEY) throw new Error('Paystack is not configured.');
    const payment = await withState(state => state.payments?.find(p => p.reference === reference), false, ['payments']);
    if (!payment || !['Savings', 'Contribution'].includes(payment.purpose)) throw new Error('Savings or contribution payment not found.');
    if (payment.status !== 'Successful') throw new Error('Use the portal to verify pending payments first.');
    const verified = await paystackRequest('/transaction/verify/' + encodeURIComponent(reference), process.env.PAYSTACK_SECRET_KEY);
    if (verified.reference !== reference || verified.status !== 'success') throw new Error('Paystack did not confirm this payment as successful.');
    const result = await withState(state => {
        const fresh = state.payments?.find(p => p.reference === reference);
        if (!fresh || fresh.memberId !== payment.memberId || fresh.purpose !== payment.purpose || fresh.amount !== payment.amount) throw new Error('Payment changed; aborting reconciliation.');
        const neededRecovery = paymentNeedsLedgerCredit(fresh);
        reconcilePayment(state, verified);
        const entries = state.transactions.filter(t => t.reference === reference && t.memberId === fresh.memberId && t.type === fresh.purpose);
        if (fresh.reconciliationStatus !== 'Applied' || entries.length !== 1 || entries[0].amount !== fresh.amount) throw new Error('Ledger conflict requires administrator review; no repair saved.');
        return { mode: apply ? 'applied' : 'dry-run', neededRecovery, amountKobo: fresh.amount, ledgerEntries: entries.length, savingsTotalKobo: state.transactions.filter(t => t.memberId === fresh.memberId && t.type === 'Savings').reduce((sum, t) => sum + t.amount, 0) };
    }, apply);
    console.log(JSON.stringify(result));
    process.exit(0);
} catch (error) {
    console.error(error instanceof Error ? error.message : 'Reconciliation failed.');
    process.exit(1);
}
