import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveBalancePayment, reconcilePayment, membershipPayment } from '../src/lib/payments.ts';
import { adminAction } from '../src/lib/admin.ts';
import type { Member, State } from '../src/lib/store.ts';
function fixture() {
    const member = { id: 'member', email: 'member@example.com', role: 'member', status: 'Active' } as Member;
    const admin = { ...member, id: 'admin', role: 'admin' } as Member;
    const state: State = { members: [member, admin], payments: [{ id: 'fee', memberId: member.id, reference: 'fee', amount: 1000, currency: 'NGN', purpose: 'Membership fee', status: 'Successful', createdAt: '2026-01-01' }], paymentSettings: { enabled: true, membershipFee: 1000, contributionAmount: 50000 }, transactions: [], loans: [], audit: [], withdrawals: [], announcements: [] };
    return { member, admin, state };
}
test('contributions use the administrator amount and reuse pending checkout', () => {
    const { state, member } = fixture();
    const p = reserveBalancePayment(state, member, 'Contribution', '0.01', new Date(), 'legacy-general', 'once');
    assert.equal(p.amount, 50000);
    assert.equal(membershipPayment(p), false);
    assert.throws(() => reserveBalancePayment(state, member, 'Contribution', '999', new Date(), 'legacy-general', 'once'), /pending/);
    p.checkoutUrl = 'https://checkout.paystack.com/test';
    assert.equal(reserveBalancePayment(state, member, 'Contribution', '999', new Date(), 'legacy-general', 'once').id, p.id);
    state.paymentSettings!.contributionAmount = 60000;
    assert.throws(() => reserveBalancePayment(state, member, 'Contribution', '999', new Date(), 'legacy-general', 'once'), /previous amount/);
});
test('savings validate amounts, approval, fee and collection status', () => {
    const { state, member } = fixture();
    for (const value of ['0', '-1', '1.001', 'NaN']) assert.throws(() => reserveBalancePayment(state, member, 'Savings', value));
    assert.equal(reserveBalancePayment(state, member, 'Savings', '12.34').amount, 1234);
    assert.throws(() => reserveBalancePayment(state, member, 'Savings', '13.00'), /different amount/);
    assert.throws(() => reserveBalancePayment(state, { ...member, status: 'Pending review' }, 'Savings', '1'), /Active/);
    state.payments = [];
    assert.throws(() => reserveBalancePayment(state, member, 'Savings', '1'), /application fee/);
    state.paymentSettings!.enabled = false;
    assert.throws(() => reserveBalancePayment(state, member, 'Savings', '1'), /not open/);
});
test('verified savings and contributions credit the right ledger once, even after settings change', () => {
    for (const purpose of ['Contribution', 'Savings'] as const) {
        const { state, member } = fixture();
        const p = reserveBalancePayment(state, member, purpose, '25.00', new Date(), 'legacy-general', 'once');
        const verified = { reference: p.reference, amount: p.amount, currency: 'NGN', status: 'success', customer: { email: member.email } };
        assert.throws(() => reconcilePayment(state, { ...verified, amount: 1 }));
        assert.throws(() => reconcilePayment(state, { ...verified, customer: { email: 'other@example.com' } }));
        state.paymentSettings!.contributionAmount = 90000;
        state.paymentSettings!.enabled = false;
        reconcilePayment(state, verified);
        reconcilePayment(state, verified);
        assert.equal(state.transactions.length, 1);
        assert.equal(state.transactions[0].type, purpose);
        assert.equal(state.transactions[0].amount, verified.amount);
        assert.equal(p.reconciliationStatus, 'Applied');
    }
});
test('failed and mismatched payments never credit balances', () => {
    const { state, member } = fixture();
    const p = reserveBalancePayment(state, member, 'Savings', '10');
    reconcilePayment(state, { reference: p.reference, amount: p.amount, currency: 'NGN', status: 'failed', customer: { email: member.email } });
    assert.equal(state.transactions.length, 0);
    assert.equal(p.status, 'Failed');
});
test('duplicate ledger references require review rather than a second credit', () => {
    const { state, member } = fixture();
    const p = reserveBalancePayment(state, member, 'Savings', '10');
    state.transactions.push({ id: 'manual', memberId: 'different-member', date: '2026-01-01', type: 'Savings', amount: 1000, description: 'Manual', reference: p.reference, status: 'Completed' });
    reconcilePayment(state, { reference: p.reference, amount: p.amount, currency: 'NGN', status: 'success', customer: { email: member.email } });
    assert.equal(state.transactions.length, 1);
    assert.equal(p.reconciliationStatus, 'Needs review');
});
test('admin can configure, preserve and pause contributions; members cannot change settings', () => {
    const { state, member, admin } = fixture();
    const body = { action: 'payment-settings', amount: '10', enabled: true, contributionAmount: '250.50' };
    assert.throws(() => adminAction(state, member, body), /Administrator/);
    adminAction(state, admin, body);
    assert.equal(state.paymentSettings!.contributionAmount, 25050);
    adminAction(state, admin, { action: 'payment-settings', amount: '20', enabled: true });
    assert.equal(state.paymentSettings!.contributionAmount, 25050);
    adminAction(state, admin, { ...body, contributionAmount: '' });
    assert.equal(state.paymentSettings!.contributionAmount, 0);
    assert.throws(() => reserveBalancePayment(state, member, 'Contribution', '1', new Date(), 'legacy-general', 'once'), /Choose an open contribution/);
    assert.throws(() => adminAction(state, admin, { ...body, contributionAmount: '-1' }));
});

test('previously successful savings without a ledger entry are recovered exactly once', () => {
    const { state, member } = fixture();
    const payment = reserveBalancePayment(state, member, 'Savings', '25');
    payment.status = 'Successful';
    payment.verifiedAt = '2026-01-02T12:00:00.000Z';
    const verified = { reference: payment.reference, amount: payment.amount, currency: 'NGN', status: 'success', customer: { email: member.email } };
    assert.throws(() => reconcilePayment(state, { ...verified, amount: 1 }));
    assert.throws(() => reconcilePayment(state, { ...verified, status: 'failed' }));
    reconcilePayment(state, verified);
    reconcilePayment(state, verified);
    assert.equal(state.transactions.length, 1);
    assert.equal(state.transactions[0].date, '2026-01-02T12:00:00.000Z');
    assert.equal(state.transactions[0].amount, 2500);
    assert.equal(payment.reconciliationStatus, 'Applied');
});
test('a matching historical savings ledger entry is recognized without another credit', () => {
    const { state, member } = fixture();
    const payment = reserveBalancePayment(state, member, 'Savings', '10');
    payment.status = 'Successful';
    state.transactions.push({ id: 'existing', memberId: member.id, date: '2026-01-01', type: 'Savings', amount: 1000, description: 'Savings', reference: payment.reference, status: 'Completed' });
    reconcilePayment(state, { reference: payment.reference, amount: payment.amount, currency: 'NGN', status: 'success', customer: { email: member.email } });
    assert.equal(state.transactions.length, 1);
    assert.equal(payment.reconciliationStatus, 'Applied');
});
