import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validWebhook } from '../src/lib/webhook.ts';
import { reconcilePayment } from '../src/lib/payments.ts';
import type { State } from '../src/lib/store.ts';
test('webhook verifies raw signatures and rejects stale or tampered events', () => {
    const raw = Buffer.from('{"event":"charge.success"}'), key = 'test-secret', timestamp = 1000;
    const signature = createHmac('sha512', key).update('1000.').update(raw).digest('hex');
    const headers = new Headers({ 'paystack-signature': `t=${timestamp},v1=whk_test:${signature}` });
    assert.equal(validWebhook(raw, headers, { signing: key }, timestamp), true);
    assert.equal(validWebhook(raw, headers, { signing: key }, 1400), false);
    assert.equal(validWebhook(Buffer.from('tampered'), headers, { signing: key }, timestamp), false);
    const legacy = new Headers({ 'x-paystack-signature': createHmac('sha512', key).update(raw).digest('hex') });
    assert.equal(validWebhook(raw, legacy, { api: key }), true);
    assert.equal(validWebhook(raw, legacy, { signing: key, api: key }), false);
});
test('payment settlement is idempotent and verifies amount, currency and member', () => {
    const state = { members: [{ id: 'member', email: 'member@example.com' }], payments: [{ memberId: 'member', reference: 'ref', amount: 10000, currency: 'NGN', status: 'Pending' }], audit: [] } as unknown as State;
    const verified = { reference: 'ref', amount: 10000, currency: 'NGN', status: 'success', customer: { email: 'member@example.com' } };
    assert.throws(() => reconcilePayment(state, { ...verified, amount: 1 }));
    assert.throws(() => reconcilePayment(state, { ...verified, currency: 'USD' }));
    assert.throws(() => reconcilePayment(state, { ...verified, customer: { email: 'other@example.com' } }));
    reconcilePayment(state, verified); reconcilePayment(state, verified);
    assert.equal(state.payments![0].status, 'Successful');
    assert.equal(state.audit.length, 1);
});

function loanFixture() {
    const state = { members: [{ id: 'member', email: 'member@example.test', role: 'member', status: 'Active', outstanding: 12000 }], loans: [{ id: 'loan', memberId: 'member', amount: 10000, status: 'Disbursed', repaid: 0, terms: { approvedAmount: 10000, totalRepayment: 12000 } }], payments: [], transactions: [], audit: [], loanRepayments: [], paymentSettings: { enabled: true, membershipFee: 5000 } } as unknown as State;
    return { state, member: state.members[0], loan: state.loans[0] };
}
test('loan checkouts validate ownership, funding stage, balance, membership and open payments', async () => {
    const { reserveLoanPayment } = await import('../src/lib/payments.ts');
    const { state, member, loan } = loanFixture();
    assert.throws(() => reserveLoanPayment(state, { ...member, id: 'other' }, loan.id, '10'), /your disbursed/);
    assert.throws(() => reserveLoanPayment(state, { ...member, status: 'Suspended' }, loan.id, '10'), /Active/);
    assert.throws(() => reserveLoanPayment(state, member, loan.id, '120.01'), /exceeds/);
    assert.throws(() => reserveLoanPayment(state, member, loan.id, '0'));
    loan.status = 'Awaiting Disbursement'; assert.throws(() => reserveLoanPayment(state, member, loan.id, '10'), /disbursed/);
    loan.status = 'Disbursed'; state.paymentSettings!.enabled = false;
    assert.throws(() => reserveLoanPayment(state, member, loan.id, '10'), /not open/);
});
test('pending loan checkout is reused and cannot be replaced by a different payment amount', async () => {
    const { reserveLoanPayment } = await import('../src/lib/payments.ts');
    const { state, member, loan } = loanFixture();
    const first = reserveLoanPayment(state, member, loan.id, '40');
    assert.equal(first.loanId, loan.id); assert.equal(first.amount, 4000); assert.equal(first.purpose, 'Loan repayment');
    assert.throws(() => reserveLoanPayment(state, member, loan.id, '40'), /initialized/);
    first.checkoutUrl = 'https://checkout.paystack.com/test';
    assert.equal(reserveLoanPayment(state, member, loan.id, '40').reference, first.reference);
    assert.equal(state.payments!.length, 1);
    assert.throws(() => reserveLoanPayment(state, member, loan.id, '50'), /pending payment/);
});
test('verified Paystack loan repayments update the loan and ledger exactly once, including interest', async () => {
    const { reserveLoanPayment } = await import('../src/lib/payments.ts');
    const { state, member, loan } = loanFixture();
    const payment = reserveLoanPayment(state, member, loan.id, '40');
    const verified = { reference: payment.reference, amount: payment.amount, currency: 'NGN', status: 'success', customer: { email: member.email } };
    reconcilePayment(state, verified); reconcilePayment(state, verified);
    assert.equal(loan.repaid, 4000); assert.equal(loan.status, 'Repaying'); assert.equal(member.outstanding, 8000);
    assert.equal(state.transactions.length, 1); assert.equal(state.loanRepayments!.length, 1);
    assert.equal(state.loanRepayments![0].loanId, loan.id); assert.equal(payment.reconciliationStatus, 'Applied');
    const final = reserveLoanPayment(state, member, loan.id, '80');
    reconcilePayment(state, { ...verified, reference: final.reference, amount: final.amount });
    assert.equal(loan.status, 'Completed'); assert.equal(member.outstanding, 0); assert.equal(loan.repaid, 12000);
});
test('failed payments and mismatched details never reduce a loan balance', async () => {
    const { reserveLoanPayment } = await import('../src/lib/payments.ts');
    const { state, member, loan } = loanFixture();
    const payment = reserveLoanPayment(state, member, loan.id, '40');
    const verified = { reference: payment.reference, amount: payment.amount, currency: 'NGN', status: 'success', customer: { email: member.email } };
    for (const patch of [{ amount: 1 }, { currency: 'USD' }, { customer: { email: 'wrong@example.test' } }]) assert.throws(() => reconcilePayment(state, { ...verified, ...patch }), /do not match/);
    reconcilePayment(state, { ...verified, status: 'failed' });
    assert.equal(payment.status, 'Failed'); assert.equal(loan.repaid, 0); assert.equal(member.outstanding, 12000); assert.equal(state.transactions.length, 0);
    assert.doesNotThrow(() => reserveLoanPayment(state, member, loan.id, '40'));
});
test('late overpayments remain recorded for review without creating negative balances', async () => {
    const { reserveLoanPayment } = await import('../src/lib/payments.ts');
    const { state, member, loan } = loanFixture();
    const payment = reserveLoanPayment(state, member, loan.id, '120');
    loan.repaid = 4000; loan.status = 'Repaying'; member.outstanding = 8000;
    reconcilePayment(state, { reference: payment.reference, amount: 12000, currency: 'NGN', status: 'success', customer: { email: member.email } });
    assert.equal(payment.status, 'Successful'); assert.equal(payment.reconciliationStatus, 'Needs review');
    assert.equal(loan.repaid, 4000); assert.equal(member.outstanding, 8000); assert.equal(state.transactions.length, 0);
    assert.throws(() => reserveLoanPayment(state, member, loan.id, '10'), /needs review/);
});
test('loan and membership payments stay separate and provider checkout data is validated', async () => {
    const { reserveLoanPayment, membershipPayment } = await import('../src/lib/payments.ts');
    const { paystackRequest, paystackCheckout } = await import('../src/lib/paystack.ts');
    const { state, member, loan } = loanFixture();
    const payment = reserveLoanPayment(state, member, loan.id, '40');
    assert.equal(membershipPayment(payment), false);
    const data = await paystackRequest('/transaction/initialize', 'fake-secret', { amount: payment.amount, reference: payment.reference }, async (url, options) => {
        assert.equal(url, 'https://api.paystack.co/transaction/initialize'); assert.equal(options?.method, 'POST');
        assert.equal(JSON.parse(String(options?.body)).amount, 4000);
        return Response.json({ status: true, data: { reference: payment.reference, authorization_url: 'https://checkout.paystack.com/test' } });
    });
    assert.equal(paystackCheckout(data, payment.reference), 'https://checkout.paystack.com/test');
    assert.throws(() => paystackCheckout({ ...data, reference: 'wrong' }, payment.reference));
    assert.throws(() => paystackCheckout({ ...data, authorization_url: 'https://evil.example/test' }, payment.reference));
    assert.throws(() => paystackCheckout({ ...data, authorization_url: 'http://checkout.paystack.com/test' }, payment.reference));
});
