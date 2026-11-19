import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityMemberId } from '../src/lib/activity-member.ts';
const members = [{ id: 'one', number: '10000000001' }, { id: 'two', number: '10000000002' }];
test('application activity opens the applicant profile', () => {
    assert.equal(activityMemberId({ actor: 'one', action: 'Membership application submitted' }, members), 'one');
});
test('review activity resolves the affected member rather than its admin actor', () => {
    assert.equal(activityMemberId({ actor: 'admin', action: 'Member 10000000002: Active' }, members), 'two');
    assert.equal(activityMemberId({ actor: 'one', action: 'Member 10000000002: Active' }, members), 'two');
});
test('explicit subjects remain stable when activity text changes', () => {
    assert.equal(activityMemberId({ actor: 'admin', action: 'Approved', subject: { type: 'member', id: 'two' } }, members), 'two');
    assert.equal(activityMemberId({ actor: 'one', action: 'Approved', subject: { type: 'member', id: 'deleted' } }, members), null);
});
test('unrelated and removed-member activities retain the activity detail view', () => {
    assert.equal(activityMemberId({ actor: 'one', action: 'Membership fee: 100 kobo' }, members), null);
    assert.equal(activityMemberId({ actor: 'one', action: 'Vote cast in election 123' }, members), null);
    assert.equal(activityMemberId({ actor: 'deleted', action: 'Membership application submitted' }, members), null);
});
