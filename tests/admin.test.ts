import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAction, castVote, electionView } from '../src/lib/admin.ts';
import type { Member, State } from '../src/lib/store.ts';
const now = new Date('2026-11-12T12:00:00Z');
function fixture() {
    const member = { id: 'member', number: '10000000001', name: 'Member', email: 'member@example.com', role: 'member', status: 'Active', outstanding: 0 } as Member;
    const admin = { ...member, id: 'admin', role: 'admin', office: 'Treasurer' } as Member;
    const state: State = { members: [member, admin], loans: [], transactions: [], withdrawals: [], audit: [], announcements: [] };
    return { state, member, admin };
}
test('only admins can mutate administrative records', () => {
    const { state, member } = fixture();
    assert.throws(() => adminAction(state, member, { action: 'member-review', id: member.id, status: 'Suspended' }, now), /Administrator/);
    assert.equal(member.status, 'Active');
});
test('transactions require positive amounts, active members, and unique references', () => {
    const { state, admin, member } = fixture();
    const input = { action: 'transaction', memberId: member.id, amount: '12.34', type: 'Savings', reference: 'deposit-1', description: 'Deposit' };
    adminAction(state, admin, input, now);
    assert.equal(state.transactions[0].amount, 1234);
    assert.throws(() => adminAction(state, admin, input, now), /Reference/);
    assert.throws(() => adminAction(state, admin, { ...input, reference: 'deposit-2', amount: '-1' }, now));
    member.status = 'Suspended';
    assert.throws(() => adminAction(state, admin, { ...input, reference: 'deposit-3' }, now), /Active/);
    assert.equal(state.transactions.length, 1);
});
test('withdrawal approval enforces notice and loans', () => {
    const { state, admin, member } = fixture();
    state.withdrawals.push({ id: 'withdraw', memberId: member.id, reason: 'Leaving', createdAt: now.toISOString(), eligibleAt: '2027-02-12T12:00:00Z', status: 'Pending' });
    const command = { action: 'withdrawal-review', id: 'withdraw', decision: 'Approved', note: 'Reviewed' };
    assert.throws(() => adminAction(state, admin, command, now), /Notice/);
    member.outstanding = 100;
    assert.throws(() => adminAction(state, admin, command, new Date('2027-02-13')), /loans/);
    member.outstanding = 0;
    adminAction(state, admin, command, new Date('2027-02-13'));
    assert.equal(member.status, 'Withdrawn');
    assert.throws(() => adminAction(state, admin, { action: 'member-review', id: member.id, status: 'Active' }, now));
});
test('dividends prevent duplicate member-period allocations', () => {
    const { state, admin, member } = fixture();
    const command = { action: 'dividend', memberId: member.id, amount: '100.25', period: 'FY2026' };
    adminAction(state, admin, command, now);
    assert.equal(state.dividends![0].amount, 10025);
    assert.throws(() => adminAction(state, admin, { ...command, period: 'fy2026' }, now), /already/);
});
test('ballots enforce dates, eligibility, one vote and delayed result publication', () => {
    const { state, admin, member } = fixture();
    const command = { action: 'election', title: 'Chair', startsAt: '2026-11-13T12:00:00Z', endsAt: '2026-11-14T12:00:00Z', candidates: ['Amina', 'Yusuf'] };
    assert.throws(() => adminAction(state, admin, { ...command, candidates: ['Amina', 'amina'] }, now));
    adminAction(state, admin, command, now);
    const election = state.elections![0], candidate = election.candidates[0].id;
    assert.throws(() => castVote(state, member, election.id, candidate, now), /closed/);
    const during = new Date('2026-11-13T13:00:00Z');
    assert.throws(() => castVote(state, admin, election.id, candidate, during), /Active/);
    assert.throws(() => castVote(state, { ...member, status: 'Suspended' }, election.id, candidate, during));
    castVote(state, member, election.id, candidate, during);
    assert.throws(() => castVote(state, member, election.id, candidate, during), /already/);
    const safe = electionView(election, member.id);
    assert.equal(safe.hasVoted, true);
    assert.equal('votes' in safe, false);
    assert.deepEqual(safe.results, []);
    assert.throws(() => adminAction(state, admin, { action: 'election-publish', id: election.id }, during));
    adminAction(state, admin, { action: 'election-publish', id: election.id }, new Date('2026-11-15'));
    assert.equal(electionView(election).results[0].votes, 1);
});
