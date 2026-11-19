import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installmentProgress, repaymentDashboard, lagosDateKey } from '../src/lib/repayment-dates.ts';
import { loanRequestSchema } from '../src/lib/loan-validation.ts';
import type { Loan } from '../src/lib/store.ts';
const now = new Date('2026-11-12T12:00:00Z');
const loan = { id: 'loan', memberId: 'member', reference: 'IKH-EL-1', amount: 40000, status: 'Repaying', repaid: 15000, terms: { approvedAmount: 40000, installments: [{ dueDate: '2026-11-10', amount: 10000 }, { dueDate: '2026-11-12', amount: 10000 }, { dueDate: '2026-11-19', amount: 10000 }, { dueDate: '2026-11-20', amount: 10000 }] } } as Loan;
test('repayments clear the oldest installments before reducing later amounts due', () => {
    const rows = installmentProgress(loan, now);
    assert.deepEqual(rows.map(row => row.status), ['Paid', 'Due today', 'Upcoming', 'Upcoming']);
    assert.deepEqual(rows.map(row => row.outstanding), [0, 5000, 10000, 10000]);
    const dashboard = repaymentDashboard([loan], now);
    assert.equal(dashboard.overdue, 0);
    assert.equal(dashboard.dueToday, 5000);
    assert.equal(dashboard.upcoming, 10000);
    assert.equal(dashboard.rows.length, 3);
});
test('Lagos midnight changes a due-today installment to overdue', () => {
    const before = new Date('2026-11-12T22:59:59Z'), after = new Date('2026-11-12T23:00:00Z');
    assert.equal(lagosDateKey(before), '2026-11-12');
    assert.equal(lagosDateKey(after), '2026-11-13');
    assert.equal(repaymentDashboard([loan], before).dueToday, 5000);
    assert.equal(repaymentDashboard([loan], after).overdue, 5000);
    assert.equal(repaymentDashboard([loan], after).dueToday, 0);
});
test('unfunded and completed loans do not create unpaid dashboard reminders', () => {
    for (const status of ['Draft', 'Pending', 'Approved', 'Awaiting Disbursement', 'Completed', 'Cancelled', 'Rejected']) assert.equal(repaymentDashboard([{ ...loan, status }], now).rows.length, 0);
    assert.equal(repaymentDashboard([{ ...loan, repaid: 40000 }], now).rows.length, 0);
    assert.equal(installmentProgress({ ...loan, status: 'Approved', repaid: 0 }, now)[0].status, 'Scheduled');
});
test('proposed repayment dates must be valid calendar dates and not in the past', () => {
    const fields = { amount: '100', reason: 'Emergency', proposedRepaymentDate: '2026-12-01', declaration: true };
    assert.equal(loanRequestSchema.validateSync(fields, { context: { now: now.toISOString() } }).proposedRepaymentDate, '2026-12-01');
    for (const proposedRepaymentDate of ['', '2026-11-11', '2026-02-30', 'tomorrow']) assert.throws(() => loanRequestSchema.validateSync({ ...fields, proposedRepaymentDate }, { context: { now: now.toISOString() } }));
});
