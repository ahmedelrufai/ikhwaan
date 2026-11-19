import { randomUUID } from 'node:crypto';
import { audit, type Member, type State, type Payment } from './store.ts';
import { amountInKobo } from './rules.ts';
import { memberDashboardAllowed } from './access.ts';
import { applyLoanRepayment, loanBalance, referenceInUse } from './loans.ts';
export function paymentConfiguration(state: State) {
    return { enabled: state.paymentSettings?.enabled ?? process.env.PAYMENTS_APPROVED === 'true', amount: state.paymentSettings?.membershipFee ?? Number(process.env.MEMBERSHIP_FEE_KOBO) };
}
export function membershipPayment(payment: Payment) { return payment.purpose !== 'Loan repayment'; }
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
export function reconcilePayment(state: State, verified: { reference: string; amount: number; currency: string; status: string; customer?: { email?: string } }, now = new Date()) {
    const payment = state.payments?.find(p => p.reference === verified.reference);
    if (!payment) throw new Error('Payment not found.');
    const member = state.members.find(m => m.id === payment.memberId);
    if (!member || !Number.isSafeInteger(verified.amount) || verified.amount <= 0 || verified.amount !== payment.amount || verified.currency !== payment.currency || verified.customer?.email?.toLowerCase() !== (payment.customerEmail || member.email).toLowerCase()) throw new Error('Payment details do not match.');
    if (payment.status === 'Successful') return payment;
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
    payment.status = verified.status === 'success' ? 'Successful' : ['failed', 'abandoned'].includes(verified.status) ? 'Failed' : 'Pending';
    payment.verifiedAt = now.toISOString();
    audit(state, member.id, `Payment ${payment.reference}: ${payment.status}`, payment.loanId ? { type: 'loan', id: payment.loanId } : undefined);
    return payment;
}
