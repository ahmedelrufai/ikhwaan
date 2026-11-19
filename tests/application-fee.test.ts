import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationFeeRequired } from '../src/lib/application-fee.ts';
import type { Payment } from '../src/lib/store.ts';
const member = { id: 'member-1', role: 'member' as const, status: 'Active' };
const payment = (overrides: Partial<Payment> = {}): Payment => ({ id: 'p1', memberId: member.id, reference: 'ref1', amount: 10000, currency: 'NGN', status: 'Successful', createdAt: '2026-01-01', ...overrides });
test('approved members need a successful application fee payment', () => {
    assert.equal(applicationFeeRequired(member, []), true);
    assert.equal(applicationFeeRequired(member, [payment({ status: 'Pending' })]), true);
    assert.equal(applicationFeeRequired(member, [payment({ status: 'Failed' })]), true);
    assert.equal(applicationFeeRequired(member, [payment({ purpose: 'Loan repayment' })]), true);
    assert.equal(applicationFeeRequired(member, [payment({ purpose: 'Contribution' })]), true);
    assert.equal(applicationFeeRequired(member, [payment({ purpose: 'Savings' })]), true);
    assert.equal(applicationFeeRequired(member, [payment({ memberId: 'someone-else' })]), true);
    assert.equal(applicationFeeRequired(member, [payment({ purpose: 'Membership fee' })]), false);
    assert.equal(applicationFeeRequired(member, [payment()]), false);
});
test('incomplete, unapproved and administrator accounts keep their existing destinations', () => {
    assert.equal(applicationFeeRequired({ ...member, status: 'Pending review' }, []), false);
    assert.equal(applicationFeeRequired({ ...member, profileStatus: 'Incomplete' }, []), false);
    assert.equal(applicationFeeRequired({ ...member, role: 'admin' }, []), false);
});
