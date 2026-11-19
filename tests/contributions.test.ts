import test from 'node:test';
import assert from 'node:assert/strict';
import { contributionPlans, saveContributionPlan } from '../src/lib/contributions.ts';
import { contributionPeriods } from '../src/lib/contribution-periods.ts';
import { reserveBalancePayment, reconcilePayment } from '../src/lib/payments.ts';
import type { Member, State, ContributionPlan } from '../src/lib/store.ts';
const now = new Date('2026-11-19T12:00:00Z');
function fixture() {
    const member = { id: 'member', role: 'member', status: 'Active', email: 'member@example.test' } as Member;
    const admin = { ...member, id: 'admin', role: 'admin' } as Member;
    const state: State = { members: [member, admin], transactions: [], loans: [], audit: [], withdrawals: [], announcements: [], paymentSettings: { enabled: true, membershipFee: 10000 }, payments: [{ id: 'fee', memberId: member.id, reference: 'fee', amount: 10000, currency: 'NGN', purpose: 'Membership fee', status: 'Successful', createdAt: now.toISOString() }] };
    const event = saveContributionPlan(state, admin, { title: 'Family gathering', amount: '1000', frequency: 'Once', startsOn: '2026-10', active: true }, now);
    const monthly = saveContributionPlan(state, admin, { title: 'Welfare fund', amount: '500', frequency: 'Monthly', startsOn: '2026-09', active: true }, now);
    return { member, admin, state, event, monthly };
}
function settle(state: State, reference: string, amount: number) {
    return reconcilePayment(state, { reference, amount, currency: 'NGN', status: 'success', customer: { email: 'member@example.test' } }, now);
}
test('separate events and periods have independent pending checkouts and paid states', () => {
    const { state, member, event, monthly } = fixture();
    const one = reserveBalancePayment(state, member, 'Contribution', '0.01', now, event.id, 'once');
    const september = reserveBalancePayment(state, member, 'Contribution', '0.01', now, monthly.id, '2026-09');
    const november = reserveBalancePayment(state, member, 'Contribution', '0.01', now, monthly.id, '2026-11');
    assert.equal(one.amount, 100000); assert.equal(september.amount, 50000);
    assert.notEqual(september.id, november.id);
    assert.throws(() => reserveBalancePayment(state, member, 'Contribution', '1', now, monthly.id, '2026-11'), /pending/);
    settle(state, one.reference, one.amount); settle(state, september.reference, september.amount);
    assert.throws(() => reserveBalancePayment(state, member, 'Contribution', '1', now, event.id, 'once'), /already paid/);
    assert.throws(() => reserveBalancePayment(state, member, 'Contribution', '1', now, monthly.id, '2026-09'), /already paid/);
    settle(state, september.reference, september.amount);
    assert.equal(state.transactions.length, 2);
    assert.equal(state.transactions[1].contributionId, monthly.id);
    assert.equal(state.transactions[1].contributionPeriod, '2026-09');
    assert.match(state.transactions[1].description, /Welfare fund/);
});
test('unknown, paused, not yet started and invalid contribution periods are rejected', () => {
    const { state, member, monthly } = fixture();
    for (const period of ['once', '2026-08', '2026-12', '2026-99', '../admin']) assert.throws(() => reserveBalancePayment(state, member, 'Contribution', '1', now, monthly.id, period), /period/);
    assert.throws(() => reserveBalancePayment(state, member, 'Contribution', '1', now, 'missing', 'once'), /Choose an open/);
    monthly.active = false;
    assert.throws(() => reserveBalancePayment(state, member, 'Contribution', '1', now, monthly.id, '2026-11'), /Choose an open/);
    monthly.active = true; monthly.startsOn = '2026-12';
    assert.throws(() => reserveBalancePayment(state, member, 'Contribution', '1', now, monthly.id, '2026-12'), /period/);
});
test('schedules use calendar periods and Lagos month boundaries', () => {
    const { monthly } = fixture();
    assert.deepEqual(contributionPeriods(monthly, now).map(p => p.value), ['2026-11', '2026-10', '2026-09']);
    assert.equal(contributionPeriods(monthly, new Date('2026-11-30T23:30:00Z'))[0].value, '2026-12');
    assert.deepEqual(contributionPeriods({ ...monthly, frequency: 'Quarterly' }, now).map(p => p.value), ['2026-Q4', '2026-Q3']);
    assert.deepEqual(contributionPeriods({ ...monthly, frequency: 'Yearly' }, now).map(p => p.value), ['2026']);
    assert.deepEqual(contributionPeriods({ ...monthly, frequency: 'Once', startsOn: '2026-12' }, now), []);
});
test('admin can edit amount and pause funds but cannot change a used schedule', () => {
    const { state, member, admin, monthly } = fixture();
    const p = reserveBalancePayment(state, member, 'Contribution', '1', now, monthly.id, '2026-11');
    const input = { ...monthly, amount: '900', active: false };
    assert.throws(() => saveContributionPlan(state, member, input, now), /Administrator/);
    assert.throws(() => saveContributionPlan(state, admin, { ...input, frequency: 'Once' }, now), /schedule/);
    assert.throws(() => saveContributionPlan(state, admin, { ...input, startsOn: '2026-10' }, now), /schedule/);
    saveContributionPlan(state, admin, input, now);
    settle(state, p.reference, p.amount);
    assert.equal(state.transactions[0].amount, 50000);
    assert.equal(state.contributionPlans!.find(c => c.id === monthly.id)!.amount, 90000);
});
test('legacy general contribution remains manageable without deleting history', () => {
    const { state, admin } = fixture(); state.paymentSettings!.contributionAmount = 12000;
    const legacy = contributionPlans(state).find(c => c.id === 'legacy-general')!;
    saveContributionPlan(state, admin, { ...legacy, amount: '120', active: false }, now);
    assert.equal(contributionPlans(state).filter(c => c.id === legacy.id).length, 1);
    assert.equal(contributionPlans(state).find(c => c.id === legacy.id)!.active, false);
});
test('a late success on an older attempt is flagged if the period has already been credited', () => {
    const { state, member, monthly } = fixture();
    const old = reserveBalancePayment(state, member, 'Contribution', '1', now, monthly.id, '2026-11');
    old.status = 'Failed';
    const retry = reserveBalancePayment(state, member, 'Contribution', '1', now, monthly.id, '2026-11');
    settle(state, retry.reference, retry.amount);
    settle(state, old.reference, old.amount);
    assert.equal(state.transactions.length, 1);
    assert.equal(old.status, 'Successful');
    assert.equal(old.reconciliationStatus, 'Needs review');
    assert.match(old.reconciliationNote!, /already been paid/);
});
