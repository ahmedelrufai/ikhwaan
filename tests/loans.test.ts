import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAction } from '../src/lib/admin.ts';
import { emptyState, type Loan, type Member, type Office } from '../src/lib/store.ts';
import { submitLoan, saveBankAccount, savedBankAccount, cancelLoan, loanAdminAction, quorum, overdueAmount, loanBalance, repaymentSchedule, expiredApplication, yearEnd } from '../src/lib/loans.ts';
const now = new Date('2026-11-12T12:00:00Z');
const bank = { bankName: 'Test Bank', accountName: 'Member One', accountNumber: '0123456789' };
const request = { amount: '100', reason: 'Emergency', proposedRepaymentDate: '2026-12-01', declaration: true };
function fixture() {
    const member = { id: 'member', number: '10000000001', name: 'Member One', email: 'member@example.test', role: 'member', status: 'Active', outstanding: 0 } as Member;
    const officials = Object.fromEntries((['President', 'Secretary General', 'Treasurer', 'Financial Secretary'] as Office[]).map(office => [office, { ...member, id: office, role: 'admin', office, name: office }])) as Record<Office, Member>;
    const manager = { ...member, id: 'manager', role: 'admin', managesLoanPolicy: true } as Member;
    const state = emptyState(); state.members = [member, manager, ...Object.values(officials)];
    state.loanPolicy = { approvalCombination: 'A+B', documentRequired: false, configuredAt: now.toISOString() };
    saveBankAccount(state, member, bank, now);
    return { state, member, manager, officials };
}
function reviewed() {
    const f = fixture(), loan = submitLoan(f.state, f.member, request, false, now);
    for (const office of ['Financial Secretary', 'Treasurer'] as Office[]) adminAction(f.state, f.officials[office], { action: 'loan-financial-review', id: loan.id, decision: 'Approved', note: 'Financial records and availability reviewed' }, now);
    return { ...f, loan };
}
function approved() {
    const f = reviewed();
    for (const office of ['President', 'Treasurer'] as Office[]) adminAction(f.state, f.officials[office], { action: 'loan-review', id: f.loan.id, decision: 'Approved', note: 'Approved by management' }, now);
    return f;
}
function funded() {
    const f = approved();
    adminAction(f.state, f.officials['Secretary General'], { action: 'loan-terms', id: f.loan.id, approvedAmount: '90', repaymentTerms: 'Three installments; no additional charges', firstDueDate: '2026-12-01', installments: 3 }, now);
    f.loan.termsAcceptedAt = now.toISOString();
    for (const office of ['Secretary General', 'Financial Secretary'] as Office[]) adminAction(f.state, f.officials[office], { action: 'loan-disburse', id: f.loan.id, reference: 'BANK-1', date: now.toISOString() }, now);
    return f;
}
test('bank account is saved once and application payload cannot substitute payout details', () => {
    const { state, member } = fixture();
    assert.throws(() => saveBankAccount(state, member, { ...bank, accountNumber: '9999999999' }, now), /already saved/);
    const loan = submitLoan(state, member, { ...request, bankName: 'Attacker bank', accountNumber: '9999999999' }, false, now);
    assert.equal(member.bankAccount!.accountNumber, '0123456789');
    assert.equal(loan.accountNumber, '0123456789');
    assert.equal(state.members.filter(m => m.role === 'member').length, 1);
});
test('historical application account details are reused without re-entry', () => {
    const { state, member } = fixture(); delete member.bankAccount;
    state.loans.push({ ...bank, id: 'old', memberId: member.id, amount: 1, reason: 'Old', status: 'Cancelled', queue: 1, period: '2025-01', createdAt: '2025-01-01T12:00:00Z' });
    assert.equal(savedBankAccount(state, member)!.accountNumber, '0123456789');
    assert.equal(submitLoan(state, member, request, false, now).accountNumber, '0123456789');
});
test('active membership, saved account, request fields and declaration are required', () => {
    const { state, member } = fixture();
    assert.throws(() => submitLoan(state, { ...member, bankAccount: undefined }, request, false, now), /bank account/);
    assert.throws(() => submitLoan(state, { ...member, status: 'Pending review' }, request, false, now), /Active/);
    for (const patch of [{ amount: '0' }, { reason: '' }, { proposedRepaymentDate: '' }, { declaration: false }]) assert.throws(() => submitLoan(state, member, { ...request, ...patch }, false, now));
    state.loanPolicy!.documentRequired = true;
    assert.throws(() => submitLoan(state, member, request, false, now), /supporting document/);
});
test('drafts can be resumed and submit into a unique calendar-year queue reference', () => {
    const { state, member } = fixture();
    const draft = submitLoan(state, member, {}, true, now);
    assert.equal(draft.status, 'Draft'); assert.equal(draft.queue, 0);
    const submitted = submitLoan(state, member, { ...request, id: draft.id }, false, now);
    assert.equal(submitted.id, draft.id); assert.equal(submitted.status, 'Pending'); assert.equal(submitted.queue, 1); assert.match(submitted.reference!, /^IKH-EL-2026-/);
    assert.equal(state.loans.length, 1);
    assert.throws(() => submitLoan(state, member, { ...request, id: draft.id }, false, now), /draft/);
    assert.throws(() => submitLoan(state, member, request, false, now), /active application/);
});
test('outstanding loans require a distinct A+B-authorised one-use exception', () => {
    const { state, member, officials } = fixture(); member.outstanding = 500;
    assert.throws(() => submitLoan(state, member, request, false, now), /outstanding/);
    adminAction(state, officials.President, { action: 'loan-exception', memberId: member.id, note: 'Emergency exception' }, now);
    assert.throws(() => submitLoan(state, member, request, false, now), /outstanding/);
    adminAction(state, officials.Treasurer, { action: 'loan-exception', memberId: member.id, note: 'Availability confirmed' }, now);
    const loan = submitLoan(state, member, request, false, now);
    assert.ok(loan.exception); assert.equal(state.loanExceptions![0].usedByLoanId, loan.id);
    cancelLoan(state, member, loan.id, now);
    assert.throws(() => submitLoan(state, member, request, false, now), /outstanding/);
});
test('financial reviews precede management signoff and one official cannot meet A+B', () => {
    const f = fixture(), loan = submitLoan(f.state, f.member, request, false, now);
    assert.throws(() => adminAction(f.state, f.officials.President, { action: 'loan-review', id: loan.id, decision: 'Approved', note: 'Approved' }, now), /reviews/);
    assert.throws(() => adminAction(f.state, f.officials.Treasurer, { action: 'loan-financial-review', id: loan.id, decision: 'Approved', note: 'Available' }, now), /Secretary/);
    assert.equal(quorum(f.state, [{ actorId: 'President', office: 'President' }, { actorId: 'President', office: 'Treasurer' }]), false);
    assert.throws(() => loanAdminAction(f.state, f.manager, { action: 'loan-review', id: loan.id, decision: 'Approved', note: 'Approved' }, now), /office/);
});
test('A+B and all-four policies count current, distinct office holders', () => {
    const f = reviewed();
    f.state.loanPolicy!.approvalCombination = 'All four';
    f.loan.policySnapshot!.approvalCombination = 'All four';
    for (const office of ['President', 'Treasurer', 'Financial Secretary'] as Office[]) adminAction(f.state, f.officials[office], { action: 'loan-review', id: f.loan.id, decision: 'Approved', note: 'Approved' }, now);
    assert.equal(f.loan.status, 'Under Review');
    adminAction(f.state, f.officials['Secretary General'], { action: 'loan-review', id: f.loan.id, decision: 'Approved', note: 'Management approved' }, now);
    assert.equal(f.loan.status, 'Approved');
    f.officials.President.status = 'Suspended';
    assert.equal(quorum(f.state, f.state.loanApprovals!.filter(a => a.stage === 'Approval')), false);
});
test('rejection needs a reason and is audited; subsequent review is blocked', () => {
    const f = fixture(), loan = submitLoan(f.state, f.member, request, false, now);
    assert.throws(() => adminAction(f.state, f.officials['Financial Secretary'], { action: 'loan-financial-review', id: loan.id, decision: 'Rejected', note: ' ' }, now));
    adminAction(f.state, f.officials['Financial Secretary'], { action: 'loan-financial-review', id: loan.id, decision: 'Rejected', note: 'Eligibility not met' }, now);
    assert.equal(loan.status, 'Rejected'); assert.ok(f.state.audit.some(a => a.action.includes('Eligibility not met')));
    assert.throws(() => adminAction(f.state, f.officials.President, { action: 'loan-review', id: loan.id, decision: 'Approved', note: 'Override' }, now));
});
test('Secretary General records principal and schedule; member acceptance precedes disbursement', () => {
    const f = approved(), terms = { action: 'loan-terms', id: f.loan.id, approvedAmount: '90', repaymentTerms: 'Three monthly installments', firstDueDate: '2026-12-01', installments: 3 };
    assert.throws(() => adminAction(f.state, f.officials.Treasurer, terms, now), /Secretary General/);
    assert.throws(() => adminAction(f.state, f.officials['Secretary General'], { ...terms, approvedAmount: '101' }, now), /exceed/);
    adminAction(f.state, f.officials['Secretary General'], terms, now);
    assert.equal(f.loan.status, 'Awaiting Disbursement');
    assert.equal(f.loan.terms!.installments.reduce((sum, i) => sum + i.amount, 0), 9000);
    assert.throws(() => adminAction(f.state, f.officials.Treasurer, { action: 'loan-disburse', id: f.loan.id, reference: 'BANK-1', date: now.toISOString() }, now), /accept/);
});
test('disbursement uses the approved amount and requires matching transfer details and quorum', () => {
    const f = approved();
    adminAction(f.state, f.officials['Secretary General'], { action: 'loan-terms', id: f.loan.id, approvedAmount: '90', repaymentTerms: 'Three installments', firstDueDate: '2026-12-01', installments: 3 }, now);
    f.loan.termsAcceptedAt = now.toISOString();
    const transfer = { action: 'loan-disburse', id: f.loan.id, reference: 'BANK-1', date: now.toISOString() };
    adminAction(f.state, f.officials['Secretary General'], transfer, now);
    assert.equal(f.loan.status, 'Awaiting Disbursement'); assert.equal(f.member.outstanding, 0);
    assert.throws(() => adminAction(f.state, f.officials.Treasurer, { ...transfer, reference: 'WRONG' }, now), /same transfer/);
    adminAction(f.state, f.officials.Treasurer, transfer, now);
    assert.equal(f.loan.status, 'Disbursed'); assert.equal(f.member.outstanding, 9000); assert.equal(f.state.transactions[0].amount, 9000);
    assert.throws(() => adminAction(f.state, f.officials.Treasurer, transfer, now));
});
test('repayments are loan-specific, cannot exceed balances, and close fully paid loans', () => {
    const f = funded(), repayment = { action: 'transaction', type: 'Loan repayment', loanId: f.loan.id, amount: '40', reference: 'REPAY-1', description: 'Monthly repayment' };
    assert.throws(() => adminAction(f.state, f.officials.President, repayment, now), /Signatory-B/);
    adminAction(f.state, f.officials.Treasurer, repayment, now);
    assert.equal(f.loan.status, 'Repaying'); assert.equal(loanBalance(f.loan), 5000); assert.equal(f.member.outstanding, 5000);
    assert.equal(overdueAmount(f.loan, new Date('2027-03-01')), 5000);
    assert.throws(() => adminAction(f.state, f.officials.Treasurer, repayment, now), /Reference/);
    assert.throws(() => adminAction(f.state, f.officials.Treasurer, { ...repayment, amount: '51', reference: 'REPAY-2' }, now), /exceeds/);
    adminAction(f.state, f.officials['Financial Secretary'], { ...repayment, amount: '50', reference: 'REPAY-2' }, now);
    assert.equal(f.loan.status, 'Completed'); assert.equal(f.member.outstanding, 0); assert.equal(f.state.loanRepayments!.length, 2);
});
test('queue year uses Lagos time, retains history and renews into a new review cycle', () => {
    const f = reviewed();
    const later = new Date('2026-12-31T23:30:00Z');
    assert.equal(expiredApplication(f.loan, later), true);
    assert.throws(() => adminAction(f.state, f.officials.President, { action: 'loan-review', id: f.loan.id, decision: 'Approved', note: 'Late' }, later), /closed/);
    assert.equal(f.state.loans.length, 1);
    const historyCount = f.state.loanApprovals!.length;
    adminAction(f.state, f.officials['Secretary General'], { action: 'loan-renew', id: f.loan.id, note: 'Renewed by committee' }, later);
    assert.equal(f.loan.status, 'Pending'); assert.equal(f.loan.reviewCycle, 2); assert.equal(f.state.loanApprovals!.length, historyCount);
    assert.equal(f.loan.expiresAt, '2027-12-31T23:59:59.999+01:00');
});
test('monthly schedules preserve month ends and every kobo', () => {
    const schedule = repaymentSchedule(10001, '2027-01-31', 3);
    assert.deepEqual(schedule.map(i => i.dueDate), ['2027-01-31', '2027-02-28', '2027-03-31']);
    assert.equal(schedule.reduce((sum, i) => sum + i.amount, 0), 10001);
    assert.throws(() => repaymentSchedule(1000, '2027-02-30', 2));
    assert.match(yearEnd(now), /2026-12-31/);
});
test('cancellation preserves decisions and blocks financial actions', () => {
    const f = reviewed(); cancelLoan(f.state, f.member, f.loan.id, now);
    assert.equal(f.loan.status, 'Cancelled'); assert.equal(f.state.loanApprovals!.length, 2);
    assert.throws(() => adminAction(f.state, f.officials.President, { action: 'loan-review', id: f.loan.id, decision: 'Approved', note: 'Too late' }, now));
});
test('only the policy manager assigns offices; all role changes are audited', () => {
    const f = fixture();
    assert.throws(() => adminAction(f.state, f.officials.President, { action: 'loan-policy', approvalCombination: 'A+B', documentRequired: true }, now), /manager/);
    adminAction(f.state, f.manager, { action: 'loan-policy', approvalCombination: 'All four', documentRequired: true }, now);
    assert.equal(f.state.loanPolicy!.approvalCombination, 'All four');
    assert.throws(() => adminAction(f.state, f.manager, { action: 'loan-office', memberId: f.member.id, office: 'President' }, now), /already assigned/);
    assert.ok(f.state.audit.some(a => a.action.includes('Loan policy configured')));
});

test('assigning an office preserves a member identity and does not permit self-approval', () => {
    const f = fixture();
    const loan = submitLoan(f.state, f.member, request, false, now);
    adminAction(f.state, f.manager, { action: 'loan-office', memberId: f.officials.Treasurer.id, office: 'None' }, now);
    adminAction(f.state, f.manager, { action: 'loan-office', memberId: f.member.id, office: 'Treasurer' }, now);
    assert.equal(f.member.role, 'member'); assert.equal(f.member.office, 'Treasurer');
    assert.throws(() => adminAction(f.state, f.member, { action: 'loan-review', id: loan.id, decision: 'Approved', note: 'Own request' }, now), /own loan/);
    assert.equal(f.state.members.filter(m => m.id === f.member.id).length, 1);
});
test('renewal cannot reuse approval signatures from a prior review cycle', () => {
    const f = approved();
    adminAction(f.state, f.officials['Secretary General'], { action: 'loan-reopen', id: f.loan.id, note: 'Management reassessment' }, now);
    assert.equal(f.loan.reviewCycle, 2);
    assert.throws(() => adminAction(f.state, f.officials.President, { action: 'loan-review', id: f.loan.id, decision: 'Approved', note: 'New decision' }, now), /reviews/);
    assert.ok(f.state.loanApprovals!.length >= 4);
});

for (const [rule, accepted, denied] of [
    ['A only', 'President', 'Treasurer'], ['B only', 'Treasurer', 'President'],
    ['Either A or B', 'President', null], ['Either A or B', 'Treasurer', null],
] as const) test(`${rule} accepts ${accepted} and restricts unauthorized decisions`, () => {
    const f = fixture(); f.state.loanPolicy!.approvalCombination = rule;
    const loan = submitLoan(f.state, f.member, request, false, now);
    const decision = { action: 'loan-review', id: loan.id, decision: 'Approved', note: 'Authorized decision' };
    assert.throws(() => adminAction(f.state, f.officials[accepted], decision, now), /reviews/);
    for (const office of ['Financial Secretary', 'Treasurer'] as Office[]) adminAction(f.state, f.officials[office], { ...decision, action: 'loan-financial-review' }, now);
    if (denied) for (const result of ['Approved', 'Rejected']) assert.throws(() => adminAction(f.state, f.officials[denied], { ...decision, decision: result }, now), /not authorized/);
    adminAction(f.state, f.officials[accepted], decision, now);
    assert.equal(loan.status, 'Approved');
});
test('policy edits preserve submitted and legacy loans while new submissions get new rules', () => {
    const f = reviewed();
    const legacy: Loan = { ...f.loan, id: 'legacy', policySnapshot: undefined }; f.state.loans.push(legacy);
    adminAction(f.state, f.manager, { action: 'loan-policy', approvalCombination: 'B only', disbursementCombination: 'All four', documentRequired: false }, now);
    assert.equal(f.loan.policySnapshot!.approvalCombination, 'A+B');
    assert.equal(legacy.policySnapshot!.approvalCombination, 'A+B');
    for (const office of ['President', 'Treasurer'] as Office[]) adminAction(f.state, f.officials[office], { action: 'loan-review', id: f.loan.id, decision: 'Approved', note: 'Old policy retained' }, now);
    assert.equal(f.loan.status, 'Approved');
    cancelLoan(f.state, f.member, f.loan.id, now); cancelLoan(f.state, f.member, legacy.id, now);
    assert.equal(submitLoan(f.state, f.member, request, false, now).policySnapshot!.approvalCombination, 'B only');
});
test('A-only approval can require distinct A+B transfer verification', () => {
    const f = fixture(); f.state.loanPolicy = { ...f.state.loanPolicy!, approvalCombination: 'A only', disbursementCombination: 'A+B' };
    const loan = submitLoan(f.state, f.member, request, false, now);
    for (const office of ['Financial Secretary', 'Treasurer'] as Office[]) adminAction(f.state, f.officials[office], { action: 'loan-financial-review', id: loan.id, decision: 'Approved', note: 'Checked' }, now);
    adminAction(f.state, f.officials.President, { action: 'loan-review', id: loan.id, decision: 'Approved', note: 'Approved' }, now);
    adminAction(f.state, f.officials['Secretary General'], { action: 'loan-terms', id: loan.id, approvedAmount: '100', firstDueDate: '2026-12-01', installments: 1 }, now);
    loan.termsAcceptedAt = now.toISOString();
    const transfer = { action: 'loan-disburse', id: loan.id, reference: 'SEPARATE-POLICY', date: now.toISOString() };
    adminAction(f.state, f.officials.President, transfer, now); assert.equal(loan.status, 'Awaiting Disbursement');
    adminAction(f.state, f.officials.Treasurer, transfer, now); assert.equal(loan.status, 'Disbursed');
    assert.equal(f.member.outstanding, 10000);
    assert.throws(() => adminAction(f.state, f.officials.Treasurer, transfer, now));
});
test('B-only transfer policy rejects A and completes with B', () => {
    const f = approved(); f.loan.policySnapshot!.disbursementCombination = 'B only';
    adminAction(f.state, f.officials['Secretary General'], { action: 'loan-terms', id: f.loan.id, approvedAmount: '100', firstDueDate: '2026-12-01', installments: 1 }, now);
    f.loan.termsAcceptedAt = now.toISOString();
    const transfer = { action: 'loan-disburse', id: f.loan.id, reference: 'B-TRANSFER', date: now.toISOString() };
    assert.throws(() => adminAction(f.state, f.officials.President, transfer, now), /not authorized/);
    assert.equal(f.loan.pendingDisbursement, undefined);
    adminAction(f.state, f.officials.Treasurer, transfer, now); assert.equal(f.loan.status, 'Disbursed');
});
test('exception authorization retains its rule after organization policy changes', () => {
    const f = fixture(); f.member.outstanding = 100;
    adminAction(f.state, f.officials.President, { action: 'loan-exception', memberId: f.member.id, note: 'Exception' }, now);
    adminAction(f.state, f.manager, { action: 'loan-policy', approvalCombination: 'A only', disbursementCombination: 'B only', documentRequired: false }, now);
    assert.throws(() => submitLoan(f.state, f.member, request, false, now), /outstanding/);
    adminAction(f.state, f.officials.Treasurer, { action: 'loan-exception', memberId: f.member.id, note: 'Confirmed' }, now);
    assert.ok(submitLoan(f.state, f.member, request, false, now).exception);
});
test('policy validation rejects unknown combinations without altering existing policy', () => {
    const f = fixture();
    for (const patch of [{ approvalCombination: 'Anyone' }, { disbursementCombination: 'Anyone' }]) {
        assert.throws(() => adminAction(f.state, f.manager, { action: 'loan-policy', approvalCombination: 'A only', disbursementCombination: 'A+B', documentRequired: false, ...patch }, now));
        assert.equal(f.state.loanPolicy!.approvalCombination, 'A+B');
    }
});
test('official checkboxes require exactly the selected offices for each stage', () => {
    const f = fixture();
    adminAction(f.state, f.manager, { action: 'loan-policy', approvalOffices: ['President', 'Secretary General'], disbursementOffices: ['Financial Secretary'], documentRequired: false }, now);
    const loan = submitLoan(f.state, f.member, request, false, now);
    const decision = { id: loan.id, decision: 'Approved', note: 'Checked' };
    for (const office of ['Financial Secretary', 'Treasurer'] as Office[]) adminAction(f.state, f.officials[office], { ...decision, action: 'loan-financial-review' }, now);
    assert.throws(() => adminAction(f.state, f.officials.Treasurer, { ...decision, action: 'loan-review' }, now), /not authorized/);
    adminAction(f.state, f.officials.President, { ...decision, action: 'loan-review' }, now);
    assert.equal(loan.status, 'Under Review');
    adminAction(f.state, f.officials['Secretary General'], { ...decision, action: 'loan-review' }, now);
    assert.equal(loan.status, 'Approved');
    adminAction(f.state, f.officials['Secretary General'], { action: 'loan-terms', id: loan.id, approvedAmount: '100', firstDueDate: '2026-12-01', installments: 1 }, now);
    loan.termsAcceptedAt = now.toISOString();
    const transfer = { action: 'loan-disburse', id: loan.id, reference: 'SELECTED-OFFICIAL', date: now.toISOString() };
    assert.throws(() => adminAction(f.state, f.officials.Treasurer, transfer, now), /not authorized/);
    adminAction(f.state, f.officials['Financial Secretary'], transfer, now);
    assert.equal(loan.status, 'Disbursed');
});
test('official selections must be known and nonempty for both stages', () => {
    const f = fixture();
    for (const patch of [{ approvalOffices: [] }, { disbursementOffices: [] }, { approvalOffices: ['Unknown'] }, { disbursementOffices: undefined }]) {
        assert.throws(() => adminAction(f.state, f.manager, { action: 'loan-policy', approvalOffices: ['President'], disbursementOffices: ['Treasurer'], documentRequired: false, ...patch }, now));
        assert.equal(f.state.loanPolicy!.approvalOffices, undefined);
    }
});

test('selected President can approve without unassigned financial review offices', () => {
    const f = fixture();
    f.state.members = f.state.members.filter(m => !m.office || m.office === 'President');
    adminAction(f.state, f.manager, { action: 'loan-policy', approvalOffices: ['President'], disbursementOffices: ['President'], documentRequired: false }, now);
    const loan = submitLoan(f.state, f.member, request, false, now);
    adminAction(f.state, f.officials.President, { action: 'loan-review', id: loan.id, decision: 'Approved', note: 'Approved by selected official' }, now);
    assert.equal(loan.status, 'Approved');
    assert.equal(f.state.loanApprovals!.length, 1);
});
test('post-approval actions follow saved loan and transfer permissions', () => {
    const f = fixture();
    adminAction(f.state, f.manager, { action: 'loan-policy', approvalOffices: ['President'], disbursementOffices: ['Treasurer'], documentRequired: false }, now);
    const loan = submitLoan(f.state, f.member, request, false, now);
    adminAction(f.state, f.officials.President, { action: 'loan-review', id: loan.id, decision: 'Approved', note: 'Approved' }, now);
    const terms = { action: 'loan-terms', id: loan.id, approvedAmount: '100', firstDueDate: '2026-12-01', installments: 2 };
    assert.throws(() => adminAction(f.state, f.officials['Secretary General'], terms, now), /selected loan approver/);
    assert.throws(() => adminAction(f.state, f.officials.Treasurer, terms, now), /selected loan approver/);
    adminAction(f.state, f.officials.President, terms, now);
    assert.equal(loan.status, 'Awaiting Disbursement');
    assert.equal(loan.terms!.recordedBy, f.officials.President.id);
    const transfer = { action: 'loan-disburse', id: loan.id, reference: 'POST-APPROVAL', date: now.toISOString() };
    assert.throws(() => adminAction(f.state, f.officials.Treasurer, transfer, now), /accept/);
    loan.termsAcceptedAt = now.toISOString();
    assert.throws(() => adminAction(f.state, f.officials.President, transfer, now), /not authorized/);
    adminAction(f.state, f.officials.Treasurer, transfer, now);
    assert.equal(loan.status, 'Disbursed');
    assert.equal(f.member.outstanding, 10000);
});
test('selected loan approver can reopen terms while transfer-only official cannot', () => {
    const f = fixture();
    adminAction(f.state, f.manager, { action: 'loan-policy', approvalOffices: ['President'], disbursementOffices: ['Treasurer'], documentRequired: false }, now);
    const loan = submitLoan(f.state, f.member, request, false, now);
    adminAction(f.state, f.officials.President, { action: 'loan-review', id: loan.id, decision: 'Approved', note: 'Approved' }, now);
    const reopen = { action: 'loan-reopen', id: loan.id, note: 'Reassessment required' };
    assert.throws(() => adminAction(f.state, f.officials.Treasurer, reopen, now), /cannot be reopened/);
    adminAction(f.state, f.officials.President, reopen, now);
    assert.equal(loan.status, 'Under Review');
    assert.equal(loan.reviewCycle, 2);
});
test('interest offer keeps bank transfer principal separate from total repayment', async () => {
    const { respondToLoanTerms } = await import('../src/lib/loans.ts');
    const f = fixture();
    adminAction(f.state, f.manager, { action: 'loan-policy', approvalOffices: ['President'], disbursementOffices: ['Treasurer'], documentRequired: false }, now);
    const loan = submitLoan(f.state, f.member, { ...request, amount: '500000' }, false, now);
    adminAction(f.state, f.officials.President, { action: 'loan-review', id: loan.id, decision: 'Approved', note: 'Approved' }, now);
    adminAction(f.state, f.officials.President, { action: 'loan-terms', id: loan.id, approvedAmount: '500000', interestRate: '5', firstDueDate: '2026-12-01', installments: 10 }, now);
    assert.equal(loan.terms!.interestAmount, 2500000);
    assert.equal(loan.terms!.totalRepayment, 52500000);
    assert.ok(loan.terms!.installments.every(i => i.amount === 5250000));
    respondToLoanTerms(f.state, f.member, loan.id, true, now);
    assert.throws(() => respondToLoanTerms(f.state, f.member, loan.id, false, now), /No new/);
    adminAction(f.state, f.officials.Treasurer, { action: 'loan-disburse', id: loan.id, reference: 'INTEREST-TRANSFER', date: now.toISOString() }, now);
    assert.equal(f.state.transactions.find(t => t.reference === 'INTEREST-TRANSFER')!.amount, 50000000);
    assert.equal(loanBalance(loan), 52500000);
    assert.equal(f.member.outstanding, 52500000);
    adminAction(f.state, f.officials.Treasurer, { action: 'transaction', type: 'Loan repayment', loanId: loan.id, amount: '500000', reference: 'INTEREST-PRINCIPAL', description: 'Principal paid' }, now);
    assert.equal(loan.status, 'Repaying'); assert.equal(loanBalance(loan), 2500000);
    adminAction(f.state, f.officials.Treasurer, { action: 'transaction', type: 'Loan repayment', loanId: loan.id, amount: '25000', reference: 'INTEREST-REMAINDER', description: 'Remaining balance' }, now);
    assert.equal(loan.status, 'Completed'); assert.equal(f.member.outstanding, 0);
});
test('member can decline an unaccepted offer without creating debt', async () => {
    const { respondToLoanTerms } = await import('../src/lib/loans.ts');
    const f = approved();
    adminAction(f.state, f.officials['Secretary General'], { action: 'loan-terms', id: f.loan.id, approvedAmount: '100', interestRate: '5', firstDueDate: '2026-12-01', installments: 3 }, now);
    assert.throws(() => respondToLoanTerms(f.state, { ...f.member, id: 'another' }, f.loan.id, false, now), /No new/);
    respondToLoanTerms(f.state, f.member, f.loan.id, false, now);
    assert.equal(f.loan.status, 'Cancelled'); assert.ok(f.loan.termsDeclinedAt); assert.ok(f.loan.terms);
    assert.equal(f.member.outstanding, 0); assert.equal(f.state.transactions.length, 0);
    assert.throws(() => respondToLoanTerms(f.state, f.member, f.loan.id, true, now), /No new/);
});
test('interest calculation validates rates and preserves every kobo in schedules', async () => {
    const { calculateLoanInterest } = await import('../src/lib/loan-interest.ts');
    for (const rate of ['-1', '101', '1.001', 'NaN', '', null]) assert.throws(() => calculateLoanInterest(10000, rate));
    assert.deepEqual(calculateLoanInterest(10000, '0'), { interestRate: 0, interestAmount: 0, totalRepayment: 10000 });
    const total = calculateLoanInterest(10001, '5.25').totalRepayment;
    assert.equal(repaymentSchedule(total, '2026-12-31', 3).reduce((sum, i) => sum + i.amount, 0), total);
});

test('pending transfer references cannot be reused for contributions or repayments', () => {
    const { state, loan, member, officials } = funded();
    state.loans.push({ ...loan, id: 'pending-transfer', status: 'Awaiting Disbursement', pendingDisbursement: { reference: 'RESERVED', date: now.toISOString() } });
    assert.throws(() => adminAction(state, officials.Treasurer, { action: 'transaction', type: 'Contribution', memberId: member.id, amount: '1', description: 'Contribution', reference: 'RESERVED' }, now), /Reference already/);
    assert.throws(() => adminAction(state, officials.Treasurer, { action: 'transaction', type: 'Loan repayment', loanId: loan.id, amount: '1', description: 'Repayment', reference: 'RESERVED' }, now), /Reference already/);
});
test('replacement approver restores quorum after transfer verification starts without losing the offer', () => {
    const { state, loan, officials, member } = approved();
    adminAction(state, officials['Secretary General'], { action: 'loan-terms', id: loan.id, approvedAmount: '90', firstDueDate: '2026-12-01', installments: 3 }, now);
    loan.termsAcceptedAt = now.toISOString();
    const transfer = { action: 'loan-disburse', id: loan.id, reference: 'RECOVERY', date: now.toISOString() };
    adminAction(state, officials['Secretary General'], transfer, now);
    const terms = structuredClone(loan.terms);
    delete officials.President.office;
    const replacement = { ...officials.President, id: 'new-president', office: 'President' as Office };
    state.members.push(replacement);
    assert.throws(() => adminAction(state, officials['Financial Secretary'], transfer, now), /Current approval/);
    assert.throws(() => adminAction(state, member, { action: 'loan-confirm-approval', id: loan.id, note: 'Self confirmation' }, now), /Administrator/);
    adminAction(state, replacement, { action: 'loan-confirm-approval', id: loan.id, note: 'Confirmed existing approved offer' }, now);
    assert.deepEqual(loan.terms, terms);
    assert.equal(loan.termsAcceptedAt, now.toISOString());
    assert.equal(loan.pendingDisbursement?.reference, 'RECOVERY');
    adminAction(state, officials['Financial Secretary'], transfer, now);
    assert.equal(loan.status, 'Disbursed');
    assert.equal(member.outstanding, 9000);
    assert.equal(state.transactions.filter(t => t.reference === 'RECOVERY').length, 1);
});
test('revoked financial reviewers do not satisfy legacy prerequisites', () => {
    const { state, loan, officials } = reviewed();
    delete officials['Financial Secretary'].office;
    assert.throws(() => adminAction(state, officials.President, { action: 'loan-review', id: loan.id, decision: 'Approved', note: 'Approve' }, now), /reviews are required/);
});
