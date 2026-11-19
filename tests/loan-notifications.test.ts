import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, type Loan, type Member, type Office } from '../src/lib/store.ts';
import { loanEmailTasks, queueLoanEmails, type LoanEmail } from '../src/lib/loan-notifications.ts';
import { safeLoanDestination } from '../src/lib/loan-links.ts';
import { loanEmailConfiguration, renderLoanEmail, sendLoanEmail } from '../src/lib/loan-email-delivery.ts';
const now = new Date('2026-11-18T12:00:00Z');
function fixture(explicit = true) {
    const state = emptyState();
    const member = { id: 'borrower', name: 'Member <One>', email: 'member@example.test', role: 'member', status: 'Active', outstanding: 0 } as Member;
    const offices: Office[] = ['President', 'Secretary General', 'Treasurer', 'Financial Secretary'];
    const officials = offices.map(office => ({ ...member, id: office.replaceAll(' ', '-'), office, role: 'admin', name: office, email: office.replaceAll(' ', '-').toLowerCase() + '@example.test' } as Member));
    state.members = [member, ...officials];
    state.loanPolicy = { approvalCombination: 'A+B', documentRequired: false, configuredAt: now.toISOString(), ...(explicit ? { approvalOffices: ['President', 'Treasurer'], disbursementOffices: ['Secretary General', 'Financial Secretary'] } : {}) };
    const loan = { id: 'loan-1', memberId: member.id, reference: 'IKH-TEST', amount: 10000, reason: 'Request', status: 'Pending', createdAt: now.toISOString(), submittedAt: now.toISOString(), queue: 1, period: '2026-11', expiresAt: '2026-12-31T23:59:59+01:00', policySnapshot: structuredClone(state.loanPolicy) } as Loan;
    state.loans.push(loan);
    const sign = (office: Office, stage: 'Approval' | 'Disbursement' | 'Financial review' | 'Availability review') => {
        const actor = officials.find(m => m.office === office)!;
        (state.loanApprovals ??= []).push({ id: `${office}-${stage}`, loanId: loan.id, actorId: actor.id, office, stage, decision: 'Approved', note: 'Reviewed', createdAt: now.toISOString(), cycle: 1 });
    };
    return { state, member, officials, loan, sign };
}
test('explicit policies notify only selected current officials who still need to act', () => {
    const { state, officials, sign } = fixture();
    assert.deepEqual(loanEmailTasks(state, now).map(t => t.memberId), ['President', 'Treasurer']);
    sign('President', 'Approval');
    assert.deepEqual(loanEmailTasks(state, now).map(t => t.memberId), ['Treasurer']);
    officials.find(m => m.office === 'Treasurer')!.status = 'Suspended';
    assert.equal(loanEmailTasks(state, now).length, 0);
});
test('legacy policies notify financial reviewers in order before management approvers', () => {
    const { state, sign } = fixture(false);
    assert.deepEqual(loanEmailTasks(state, now).map(t => t.memberId), ['Financial-Secretary']);
    sign('Financial Secretary', 'Financial review');
    assert.deepEqual(loanEmailTasks(state, now).map(t => t.memberId), ['Treasurer']);
    sign('Treasurer', 'Availability review');
    assert.equal(loanEmailTasks(state, now).length, 4);
});
test('offer notifies borrower; acceptance notifies only remaining transfer signatories', () => {
    const { state, loan, sign } = fixture();
    sign('President', 'Approval'); sign('Treasurer', 'Approval');
    loan.status = 'Approved';
    assert.deepEqual(loanEmailTasks(state, now).map(t => t.button), ['Prepare loan offer', 'Prepare loan offer']);
    loan.terms = { approvedAmount: 10000, repaymentTerms: 'Monthly', installments: [{ dueDate: '2026-12-01', amount: 10000 }], recordedBy: 'President', recordedAt: now.toISOString() };
    loan.status = 'Awaiting Disbursement';
    const [offer] = loanEmailTasks(state, now);
    assert.equal(offer.memberId, 'borrower'); assert.equal(offer.path, '/portal/loans/loan-1');
    loan.termsAcceptedAt = now.toISOString();
    assert.deepEqual(loanEmailTasks(state, now).map(t => t.memberId), ['Secretary-General', 'Financial-Secretary']);
    sign('Secretary General', 'Disbursement');
    assert.deepEqual(loanEmailTasks(state, now).map(t => t.memberId), ['Financial-Secretary']);
    loan.status = 'Disbursed'; assert.equal(loanEmailTasks(state, now).length, 0);
});
test('queue deduplicates refreshes, cancels obsolete work and excludes drafts and closed loans', () => {
    const { state, loan } = fixture();
    queueLoanEmails(state, [], now); assert.equal(state.loanEmails?.length, 2);
    queueLoanEmails(state, loanEmailTasks(state, now), now); assert.equal(state.loanEmails?.length, 2);
    const before = loanEmailTasks(state, now); loan.status = 'Cancelled';
    queueLoanEmails(state, before, now);
    assert.ok(state.loanEmails?.every(e => e.status === 'Cancelled'));
    for (const status of ['Draft', 'Rejected', 'Completed', 'Repaying']) { loan.status = status; assert.equal(loanEmailTasks(state, now).length, 0); }
    loan.status = 'Pending'; assert.equal(loanEmailTasks(state, new Date('2027-01-01')).length, 0);
});
test('self-approval, saved policies and replacement holders determine recipients', () => {
    const { state, loan, officials, sign } = fixture();
    state.loanPolicy!.approvalOffices = ['Financial Secretary'];
    assert.deepEqual(loanEmailTasks(state, now).map(t => t.memberId), ['President', 'Treasurer']);
    sign('President', 'Approval'); sign('Treasurer', 'Approval'); loan.status = 'Approved';
    delete officials[0].office;
    state.members.push({ ...officials[0], id: 'replacement', office: 'President' });
    assert.equal(loanEmailTasks(state, now)[0].button, 'Confirm approval');
    loan.memberId = 'replacement';
    assert.ok(loanEmailTasks(state, now).every(t => t.memberId !== 'replacement'));
});
test('email HTML escapes content and includes a direct button and plain text fallback', async () => {
    const { state } = fixture();
    const email: LoanEmail = { ...loanEmailTasks(state, now)[0], name: '<script>bad()</script>', id: 'email-1', status: 'Pending', attempts: 0, createdAt: now.toISOString() };
    const content = renderLoanEmail(email, 'https://portal.example.test');
    assert.ok(content.html.includes('href="https://portal.example.test/admin/loans/loan-1"'));
    assert.ok(!content.html.includes('<script>')); assert.ok(content.html.includes('&lt;script&gt;'));
    assert.ok(content.text.includes('https://portal.example.test/admin/loans/loan-1'));
    let recipient = '';
    await sendLoanEmail(email, { user: 'sender@gmail.com', password: 'test', from: 'sender@gmail.com', origin: 'https://portal.example.test' }, { sendMail: async message => { recipient = message.to; assert.ok(message.messageId.includes('email-1')); return { accepted: [message.to], rejected: [] }; } });
    assert.equal(recipient, email.email);
    await assert.rejects(() => sendLoanEmail(email, { user: 'sender@gmail.com', password: 'test', from: 'sender@gmail.com', origin: 'https://portal.example.test' }, { sendMail: async () => ({ accepted: [], rejected: [email.email] }) }), /did not confirm/);
});
test('login destinations reject open redirects and incompatible account roles', () => {
    const { member, officials } = fixture();
    assert.equal(safeLoanDestination('/portal?loan=loan-1', member), '/portal?loan=loan-1');
    assert.equal(safeLoanDestination('/admin/loans/loan-1', officials[0]), '/admin/loans/loan-1');
    for (const value of ['https://evil.test', '//evil.test', '/admin/loans/loan-1?next=https://evil.test', '/portal?loan=x&next=bad']) assert.equal(safeLoanDestination(value, officials[0]), undefined);
    assert.equal(safeLoanDestination('/admin/loans/loan-1', member), undefined);
});
test('missing mail configuration disables delivery', () => {
    const previous = process.env.APP_URL;
    delete process.env.APP_URL;
    try { assert.equal(loanEmailConfiguration(), undefined); } finally { if (previous !== undefined) process.env.APP_URL = previous; }
});

test('delivery persists successes and retries, suppresses obsolete jobs and prevents concurrent claims', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { withState } = await import('../src/lib/store.ts');
    const { deliverLoanEmails } = await import('../src/lib/loan-email-delivery.ts');
    const directory = await mkdtemp(join(tmpdir(), 'ikhwaan-email-test-'));
    const overrides = { PORTAL_DATA_DIR: directory, MONGODB_URI: '', NODE_ENV: 'test', APP_URL: 'http://localhost:3000', EMAIL_USER: 'test@gmail.com', EMAIL_PASSWORD: 'fake-password', LOAN_EMAIL_FROM: 'test@gmail.com' };
    const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
    Object.assign(process.env, overrides);
    try {
        const { state } = fixture();
        state.loans[0].expiresAt = '2099-12-31T23:59:59+01:00';
        queueLoanEmails(state, [], new Date());
        await withState(stored => Object.assign(stored, state), true);
        let attempts = 0;
        const fail = { sendMail: async () => { attempts++; throw new Error('fake-password should never be persisted'); } };
        await deliverLoanEmails(1, fail);
        const failed = await withState(stored => stored.loanEmails![0]);
        assert.equal(failed.status, 'Pending'); assert.equal(failed.attempts, 1);
        assert.ok(failed.nextAttemptAt); assert.ok(!failed.lastError?.includes('fake-password'));
        await withState(stored => { stored.loanEmails![0].nextAttemptAt = '2000-01-01T00:00:00Z'; }, true);
        const seen: string[] = [];
        const success = { sendMail: async (message: { messageId: string; to: string }) => { seen.push(message.messageId); return { accepted: [message.to], rejected: [] }; } };
        await Promise.all([deliverLoanEmails(2, success), deliverLoanEmails(2, success)]);
        assert.equal(new Set(seen).size, 2); assert.equal(seen.length, 2);
        const sent = await withState(stored => stored.loanEmails!);
        assert.ok(sent.every(email => email.status === 'Sent'));
        await withState(stored => { stored.loanEmails![0].status = 'Pending'; stored.loans[0].status = 'Cancelled'; }, true);
        await deliverLoanEmails(3, success);
        assert.equal(seen.length, 2);
        assert.equal(await withState(stored => stored.loanEmails![0].status), 'Cancelled');
        assert.equal(attempts, 1);
    } finally {
        for (const key of Object.keys(overrides)) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
        await rm(directory, { recursive: true, force: true });
    }
});
