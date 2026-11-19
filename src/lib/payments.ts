import { contributionPlans } from './contributions.ts';
import { contributionPeriods } from './contribution-periods.ts';
import { randomUUID } from 'node:crypto';
import { audit, type Member, type State, type Payment } from './store.ts';
import { amountInKobo } from './rules.ts';
import { memberDashboardAllowed } from './access.ts';
import { applyLoanRepayment, loanBalance, referenceInUse } from './loans.ts';
export function paymentConfiguration(state: State) {
    return { enabled: state.paymentSettings?.enabled ?? process.env.PAYMENTS_APPROVED === 'true', amount: state.paymentSettings?.membershipFee ?? Number(process.env.MEMBERSHIP_FEE_KOBO) };
}
export function membershipPayment(payment: Payment) { return !payment.purpose || payment.purpose === 'Membership fee'; }
/** Reserve before calling Paystack so callbacks and webhooks share a stored amount. */
export function reserveBalancePayment(state: State, member: Member, purpose: 'Contribution' | 'Savings', inputAmount: unknown, now = new Date(), contributionId?: unknown, period?: unknown) {
    if (!memberDashboardAllowed(member)) throw new Error('Active membership required.');
    if (!paymentConfiguration(state).enabled) throw new Error('Online payments are not open yet.');
    if (!state.payments?.some(p => p.memberId === member.id && membershipPayment(p) && p.status === 'Successful')) throw new Error('Pay your application fee first.');
    const plan = purpose === 'Contribution' ? contributionPlans(state).find(p => p.id === contributionId && p.active) : undefined;
    if (purpose === 'Contribution' && !plan) throw new Error('Choose an open contribution.');
    if (plan && !contributionPeriods(plan, now).some(p => p.value === period)) throw new Error('Choose a valid contribution period.');
    const sameContribution = (p: Payment) => (p.contributionId === plan?.id && p.contributionPeriod === period) || (plan?.id === 'legacy-general' && !p.contributionId);
    if (plan && state.payments?.some(p => p.memberId === member.id && p.purpose === 'Contribution' && sameContribution(p) && p.status === 'Successful')) throw new Error('You have already paid this contribution for the selected period.');
    const amount = plan ? plan.amount : amountInKobo(inputAmount);
    if (!Number.isSafeInteger(amount) || !amount || amount <= 0) throw new Error('Contribution amount has not been configured.');
    const pending = state.payments?.find(p => p.memberId === member.id && p.purpose === purpose && (!plan || sameContribution(p)) && p.status === 'Pending');
    if (pending) {
        if (purpose === 'Savings' && pending.amount !== amount) throw new Error('Verify your pending savings payment before choosing a different amount.');
        if (pending.amount !== amount) throw new Error('A contribution payment at the previous amount is pending. Verify it before paying the new amount.');
        if (pending.checkoutUrl) return pending;
        throw new Error('A payment is pending. Verify it before trying again or contact the cooperative.');
    }
    const payment: Payment = { id: randomUUID(), memberId: member.id, customerEmail: member.email, purpose, ...(plan ? { contributionId: plan.id, contributionTitle: plan.title, contributionPeriod: String(period) } : {}), reference: 'ikh_' + randomUUID(), amount, currency: 'NGN', status: 'Pending', createdAt: now.toISOString() };
    (state.payments ??= []).push(payment);
    audit(state, member.id, purpose + ' payment initiated');
    return payment;
}
export function reserveLoanPayment(state: State, member: Member, loanId: unknown, inputAmount: unknown, now = new Date()) {
    if (!memberDashboardAllowed(member)) throw new Error('Active membership required.');
    if (!paymentConfiguration(state).enabled) throw new Error('Online payments are not open yet.');
    const loan = state.loans.find(loan => loan.id === loanId && loan.memberId === member.id);
    if (!loan || !['Disbursed', 'Repaying'].includes(loan.status) || !loanBalance(loan)) throw new Error('Choose one of your disbursed loans with an outstanding balance.');
    const amount = amountInKobo(inputAmount);
    if (amount > loanBalance(loan)) throw new Error('Payment exceeds this loan’s outstanding balance.');
    if (state.payments?.some(payment => payment.loanId === loan.id && payment.reconciliationStatus === 'Needs review')) throw new Error('A previous payment needs review. Contact the cooperative before making another payment.');
    const pending = state.payments?.find(payment => payment.memberId === member.id && payment.loanId === loan.id && payment.purpose === 'Loan repayment' && payment.status === 'Pending');
    if (pending) {
        if (pending.amount !== amount) throw new Error('You already have a pending payment for this loan. Verify or complete that payment before choosing a different amount.');
        if (pending.checkoutUrl) return pending;
        throw new Error('A payment is being initialized. Verify its status before retrying; contact the cooperative if it remains unavailable.');
    }
    const payment: Payment = { id: randomUUID(), memberId: member.id, customerEmail: member.email, purpose: 'Loan repayment', loanId: loan.id, reference: 'ikh_' + randomUUID(), amount, currency: 'NGN', status: 'Pending', createdAt: now.toISOString() };
    (state.payments ??= []).push(payment);
    audit(state, member.id, 'Paystack loan repayment initiated', { type: 'loan', id: loan.id });
    return payment;
}
export function paymentNeedsLedgerCredit(payment: Payment) {
    return payment.status === 'Successful' && (payment.purpose === 'Savings' || payment.purpose === 'Contribution') && !payment.reconciliationStatus;
}
export function reconcilePayment(state: State, verified: { reference: string; amount: number; currency: string; status: string; customer?: { email?: string } }, now = new Date()) {
    const payment = state.payments?.find(p => p.reference === verified.reference);
    if (!payment) throw new Error('Payment not found.');
    const member = state.members.find(m => m.id === payment.memberId);
    if (!member || !Number.isSafeInteger(verified.amount) || verified.amount <= 0 || verified.amount !== payment.amount || verified.currency !== payment.currency || verified.customer?.email?.toLowerCase() !== (payment.customerEmail || member.email).toLowerCase()) throw new Error('Payment details do not match.');
    if (payment.status === 'Successful' && !paymentNeedsLedgerCredit(payment)) return payment;
    if (payment.status === 'Successful' && verified.status !== 'success') throw new Error('Previously successful payment could not be confirmed. Contact the cooperative.');
    if (verified.status === 'success' && payment.purpose === 'Loan repayment') {
        const loan = state.loans.find(loan => loan.id === payment.loanId && loan.memberId === payment.memberId);
        if (!loan || payment.amount > loanBalance(loan) || referenceInUse(state, payment.reference)) {
            payment.reconciliationStatus = 'Needs review';
            payment.reconciliationNote = 'Paystack received the payment, but it could not be applied to the current loan balance. Contact the cooperative for reconciliation or refund.';
            audit(state, 'system', `Paystack repayment needs review: ${payment.reference}`, loan ? { type: 'loan', id: loan.id } : undefined);
        } else {
            applyLoanRepayment(state, loan, payment.amount, payment.reference, 'system', 'Loan repayment via Paystack', now);
            payment.reconciliationStatus = 'Applied';
        }
    }
    if (verified.status === 'success' && (payment.purpose === 'Contribution' || payment.purpose === 'Savings')) {
        const duplicatePeriod = payment.purpose === 'Contribution' && payment.contributionId && state.payments?.some(p => p.id !== payment.id && p.memberId === payment.memberId && p.purpose === 'Contribution' && p.contributionId === payment.contributionId && p.contributionPeriod === payment.contributionPeriod && p.status === 'Successful' && p.reconciliationStatus === 'Applied');
        const existingEntries = state.transactions.filter(t => t.reference === payment.reference);
        const alreadyRecorded = existingEntries.length === 1 && existingEntries[0].memberId === payment.memberId && existingEntries[0].amount === payment.amount && existingEntries[0].type === payment.purpose && existingEntries[0].status === 'Completed';
        if (alreadyRecorded && !duplicatePeriod) {
            payment.reconciliationStatus = 'Applied';
        } else if (referenceInUse(state, payment.reference) || duplicatePeriod) {
            payment.reconciliationStatus = 'Needs review';
            payment.reconciliationNote = duplicatePeriod ? 'Payment received, but this contribution period has already been paid. Contact the cooperative for reconciliation or refund.' : 'Payment received but its reference is already recorded. Contact the cooperative for review.';
        } else {
            state.transactions.push({ id: randomUUID(), memberId: payment.memberId, amount: payment.amount, type: payment.purpose, reference: payment.reference, date: payment.status === 'Successful' ? payment.verifiedAt || payment.createdAt : now.toISOString(), status: 'Completed', description: payment.purpose === 'Contribution' ? `${payment.contributionTitle || 'Contribution'} · ${payment.contributionPeriod || 'General'} via Paystack` : 'Savings via Paystack', ...(payment.contributionId ? { contributionId: payment.contributionId, contributionPeriod: payment.contributionPeriod } : {}) });
            payment.reconciliationStatus = 'Applied';
        }
    }
    payment.status = verified.status === 'success' ? 'Successful' : ['failed', 'abandoned'].includes(verified.status) ? 'Failed' : 'Pending';
    payment.verifiedAt = now.toISOString();
    audit(state, member.id, `Payment ${payment.reference}: ${payment.status}`, payment.loanId ? { type: 'loan', id: payment.loanId } : undefined);
    return payment;
}
