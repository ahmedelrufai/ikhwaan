import { createHash, randomUUID } from 'node:crypto';
import { administrativeAccess } from './access.ts';
import { canManageLoanTerms, policyEligible } from './loan-policy.ts';
import { currentLoanApprovals, expiredApplication, loanApprovals, quorum } from './loans.ts';
import type { Member, State } from './store.ts';

export type LoanEmailTask = { key: string; loanId: string; memberId: string; email: string; name: string; reference: string; subject: string; message: string; button: string; path: string };
export type LoanEmail = LoanEmailTask & { id: string; createdAt: string; status: 'Pending' | 'Sending' | 'Sent' | 'Cancelled'; attempts: number; firstAttemptAt?: string; nextAttemptAt?: string; leaseUntil?: string; sentAt?: string; lastError?: string };

/** Actionable recipients only; the same saved policy and current offices as the loan APIs. */
export function loanEmailTasks(state: State, now = new Date()): LoanEmailTask[] {
    const tasks: LoanEmailTask[] = [];
    for (const loan of state.loans) {
        if (expiredApplication(loan, now)) continue;
        const borrower = state.members.find(m => m.id === loan.memberId);
        if (!borrower || borrower.status !== 'Active') continue;
        const policy = loan.policySnapshot || state.loanPolicy;
        const current = (stage: Parameters<typeof loanApprovals>[2]) => loanApprovals(state, loan.id, stage).filter(a => state.members.some(m => m.id === a.actorId && administrativeAccess(m) && m.office === a.office));
        const voted = (member: Member, stage: Parameters<typeof loanApprovals>[2]) => current(stage).some(a => a.actorId === member.id && a.office === member.office);
        const financialReady = currentLoanApprovals(state, loan.id, 'Financial review').length > 0;
        const availabilityReady = currentLoanApprovals(state, loan.id, 'Availability review').length > 0;
        const reviewsReady = !!policy?.approvalOffices || financialReady && availabilityReady;
        const approvalComplete = quorum(state, currentLoanApprovals(state, loan.id, 'Approval'), policy);
        const add = (member: Member, stage: string, subject: string, message: string, button: string, memberPage = false) => {
            if (!member.email) return;
            const identity = [loan.id, loan.reviewCycle || 1, loan.terms?.recordedAt || '', stage, member.id, member.office || '', member.email];
            tasks.push({ key: createHash('sha256').update(JSON.stringify(identity)).digest('hex'), loanId: loan.id, memberId: member.id, email: member.email, name: member.name, reference: loan.reference || loan.id, subject, message, button, path: memberPage ? `/portal/loans/${encodeURIComponent(loan.id)}` : `/admin/loans/${encodeURIComponent(loan.id)}` });
        };
        if (loan.status === 'Awaiting Disbursement' && !loan.termsAcceptedAt && loan.terms) {
            add(borrower, 'offer', 'Review your loan offer', 'Your repayment offer is ready. Review the approved amount, interest and payment dates, then accept or decline the offer in your portal.', 'Review my offer', true);
        }
        for (const official of state.members.filter(m => administrativeAccess(m) && m.office && m.id !== loan.memberId)) {
            if (['Pending', 'Under Review'].includes(loan.status)) {
                if (!policy?.approvalOffices && official.office === 'Financial Secretary' && !voted(official, 'Financial review')) add(official, 'financial', 'Loan financial review needed', 'Review the member’s financial history and record your decision.', 'Review application');
                else if (!policy?.approvalOffices && official.office === 'Treasurer' && financialReady && !voted(official, 'Availability review')) add(official, 'availability', 'Loan funds review needed', 'Confirm funds availability and record your decision.', 'Review funds availability');
                else if (reviewsReady && policyEligible(policy, official.office) && !voted(official, 'Approval')) add(official, 'approval', 'Loan approval needed', 'A loan application is ready for your approval decision. Review the details and record your decision with a reason.', 'Review loan');
            } else if (['Approved', 'Awaiting Disbursement'].includes(loan.status) && !approvalComplete) {
                if (reviewsReady && policyEligible(policy, official.office) && !voted(official, 'Approval')) add(official, 'confirm', 'Confirm an existing loan approval', 'An office holder has changed. Confirm the existing approval so this loan can continue. Saved terms and transfer details are retained.', 'Confirm approval');
            } else if (loan.status === 'Approved' && canManageLoanTerms(policy, official.office)) {
                add(official, 'terms', 'Prepare a loan repayment offer', 'The required approvals are complete. Record the approved principal, interest and repayment schedule for the member to review.', 'Prepare loan offer');
            } else if (loan.status === 'Awaiting Disbursement' && loan.terms && loan.termsAcceptedAt && policyEligible(policy, official.office, true) && !voted(official, 'Disbursement')) {
                add(official, 'transfer', 'Loan transfer verification needed', 'The member has accepted the repayment offer. Verify the completed bank transfer using the actual reference and date. All required signatories must verify the same details.', 'Verify bank transfer');
            }
        }
    }
    return tasks;
}

/** Call inside the same state write as the action: failed writes never send emails. */
export function queueLoanEmails(state: State, before: LoanEmailTask[], now = new Date()) {
    const tasks = loanEmailTasks(state, now);
    const active = new Set(tasks.map(t => t.key));
    for (const email of state.loanEmails || []) if (email.status === 'Pending' && !active.has(email.key)) email.status = 'Cancelled';
    const prior = new Set(before.map(t => t.key));
    for (const task of tasks) {
        if (prior.has(task.key)) continue;
        if ((state.loanEmails || []).some(e => e.key === task.key && ['Pending', 'Sending'].includes(e.status))) continue;
        (state.loanEmails ??= []).push({ ...task, id: randomUUID(), createdAt: now.toISOString(), status: 'Pending', attempts: 0 });
    }
}
