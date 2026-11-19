import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminSnapshot, adminReadSection, ADMIN_READ_FIELDS } from '../src/lib/admin-read.ts';
import { emptyState, type Member, type Loan } from '../src/lib/store.ts';
function fixture() {
    const state = emptyState();
    const admin = { id: 'admin', role: 'admin', status: 'Active', name: 'Admin', email: 'admin@example.test', password: 'must-not-leak', managesLoanPolicy: true } as Member;
    state.members.push(admin);
    for (let index = 0; index < 80; index++) {
        const member = { id: `member-${index}`, number: String(index), role: 'member', status: 'Active', name: `Member ${index}`, phone: `0801234${index}`, email: `member${index}@example.test`, password: 'must-not-leak', outstanding: 100 } as Member;
        state.members.push(member);
        state.loans.push({ id: `loan-${index}`, reference: `IKH-${index}`, memberId: member.id, amount: 10000, reason: 'Request', status: index < 30 ? 'Pending' : 'Approved', queue: index + 1, period: '2026-11', createdAt: '2026-11-18T12:00:00Z', expiresAt: '2099-12-31T23:59:59+01:00', accountNumber: 'private-bank-number' } as Loan);
        state.audit.push({ id: `audit-${index}`, actor: admin.id, action: 'Loan approved', createdAt: '2026-11-18T12:00:00Z', subject: { type: 'loan', id: `loan-${index}` } });
    }
    state.payments = [{ id: 'payment', memberId: 'member-1', reference: 'payment-secret', amount: 1000, currency: 'NGN', status: 'Pending', createdAt: new Date().toISOString() }];
    return { state, admin };
}
test('loan registers return just the requested page while totals cover all applications', () => {
    const { state, admin } = fixture();
    const response = adminSnapshot(state, admin, new URLSearchParams({ section: 'loans', page: '2', pageSize: '10' }));
    assert.equal(response.loans.length, 10); assert.equal(response.pageMeta?.page, 2); assert.equal(response.pageMeta?.total, 80);
    assert.equal(response.loanSummary?.total, 80); assert.equal(response.loanSummary?.review, 30); assert.equal(response.loanSummary?.requested, 800000);
    assert.equal(response.loanSummary?.outstanding, 8000);
    assert.equal(response.members.length, 10); assert.equal(response.audit.length, 0); assert.equal(response.payments.length, 0);
    assert.ok(!JSON.stringify(response).includes('must-not-leak')); assert.ok(!JSON.stringify(response).includes('private-bank-number'));
    const filtered = adminSnapshot(state, admin, new URLSearchParams({ section: 'loans', search: 'IKH-7' }));
    assert.equal(filtered.pageMeta?.total, 11); assert.equal(filtered.loanSummary?.total, 80);
    const review = adminSnapshot(state, admin, new URLSearchParams({ section: 'loans', status: 'Review queue' }));
    assert.equal(review.pageMeta?.total, 30);
});
test('member and audit pagination preserve correct counts and activity links', () => {
    const { state, admin } = fixture();
    const members = adminSnapshot(state, admin, new URLSearchParams({ section: 'members', page: '3', pageSize: '25' }));
    assert.equal(members.members.length, 25); assert.equal(members.pageMeta?.start, 51); assert.equal(members.memberTotal, 80);
    const audit = adminSnapshot(state, admin, new URLSearchParams({ section: 'audit', pageSize: '10' }));
    assert.equal(audit.audit.length, 10); assert.equal(audit.pageMeta?.total, 80); assert.equal(audit.loans.length, 10);
});
test('detail responses include the selected record and omit unrelated financial records', () => {
    const { state, admin } = fixture();
    const detail = adminSnapshot(state, admin, new URLSearchParams({ section: 'loan-details', id: 'loan-1' }));
    assert.equal(detail.loans.length, 1); assert.equal(detail.members[0].id, 'member-1');
    assert.equal(detail.loans[0].accountNumber, 'private-bank-number'); assert.equal(detail.payments.length, 0);
    assert.equal(detail.recordId, 'loan-1');
    assert.throws(() => adminReadSection('nonexistent'), /Unknown/);
    assert.deepEqual(ADMIN_READ_FIELDS.members, ['members']);
});
test('page-scoped responses materially reduce payload size without losing register totals', () => {
    const { state, admin } = fixture();
    const full = Buffer.byteLength(JSON.stringify(adminSnapshot(state, admin, new URLSearchParams())));
    const page = Buffer.byteLength(JSON.stringify(adminSnapshot(state, admin, new URLSearchParams({ section: 'loans' }))));
    assert.ok(page < full / 3, `Expected scoped page (${page}) to be less than a third of full response (${full})`);
});
