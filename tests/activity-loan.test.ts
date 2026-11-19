import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityLoanId } from '../src/lib/activity-loan.ts';
const loans = [{ id: 'loan-one', memberId: 'member-one', createdAt: '2026-11-12T14:00:00Z' }, { id: 'loan-two', memberId: 'member-one', createdAt: '2026-11-12T15:00:00Z' }];
const event = { actor: 'member-one', action: 'Emergency loan submitted; eligibility review required', createdAt: '2026-11-12T15:00:00Z' };
test('loan activity links to explicit loan subjects and legacy IDs', () => {
    assert.equal(activityLoanId({ ...event, subject: { type: 'loan', id: 'loan-two' } }, loans), 'loan-two');
    assert.equal(activityLoanId({ ...event, actor: 'admin', action: 'Loan loan-one: Approved' }, loans), 'loan-one');
    assert.equal(activityLoanId({ ...event, subject: { type: 'loan', id: 'deleted' } }, loans), null);
});
test('legacy application activities match only an unambiguous loan at submission time', () => {
    assert.equal(activityLoanId(event, loans), 'loan-two');
    assert.equal(activityLoanId(event, [...loans, { ...loans[1], id: 'another-loan' }]), null);
    assert.equal(activityLoanId({ ...event, createdAt: '2026-11-12T16:00:00Z' }, loans), null);
    assert.equal(activityLoanId({ ...event, action: 'Membership application submitted' }, loans), null);
});
