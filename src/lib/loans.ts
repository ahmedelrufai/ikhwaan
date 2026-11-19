import { calculateLoanInterest, loanRepaymentTotal } from './loan-interest.ts';
import { APPROVAL_COMBINATIONS, policyEligible, policyProgress, policyLabel, canManageLoanTerms } from './loan-policy.ts';
import { validDateKey } from './repayment-dates.ts';
import { administrativeAccess } from './access.ts';
import { loanRequestSchema } from './loan-validation.ts';
import { randomUUID } from 'node:crypto';
import * as yup from 'yup';
import { validateBankDetails } from './bank-details.ts';
import { amountInKobo } from './rules.ts';
import { audit, type LoanPolicy, type BankAccount, type Loan, type LoanApproval, type Member, type Office, type State } from './store.ts';

export const OFFICES: Office[] = ['President', 'Secretary General', 'Treasurer', 'Financial Secretary'];
export const LOAN_STATUSES = ['Draft', 'Pending', 'Under Review', 'Approved', 'Rejected', 'Awaiting Disbursement', 'Disbursed', 'Repaying', 'Completed', 'Cancelled'];
const text = (label: string, max = 2000) => yup.string().trim().required(`${label} is required.`).max(max, `${label}: maximum ${max} characters.`);
export function normalizedLoanStatus(loan: Loan) { return loan.status === 'Repaid' ? 'Completed' : loan.status; }
export function calendarYear(now: Date) { return Number(now.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric' })); }
export function yearEnd(now: Date) { return `${calendarYear(now)}-12-31T23:59:59.999+01:00`; }
export function expiredApplication(loan: Loan, now = new Date()) {
    return ['Draft', 'Pending', 'Under Review'].includes(loan.status) && new Date(loan.expiresAt || yearEnd(new Date(loan.submittedAt || loan.createdAt))) < now;
}
export function loanPrincipal(loan: Loan) { return loan.terms?.approvedAmount ?? loan.amount; }
export function loanBalance(loan: Loan) { return ['Disbursed', 'Repaying'].includes(loan.status) ? Math.max(0, loanRepaymentTotal(loan) - (loan.repaid || 0)) : 0; }
export function savedBankAccount(state: State, member: Member): BankAccount | undefined {
    if (member.bankAccount) return member.bankAccount;
    // Reuse bank details already supplied on a historical application.
    const prior = [...state.loans].filter(l => l.memberId === member.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const loan of prior) {
        try { return { ...validateBankDetails({ bankName: loan.bankName, accountName: loan.accountName, accountNumber: loan.accountNumber }), savedAt: loan.createdAt }; } catch { /* Older applications may not contain bank details. */ }
    }
}
export function saveBankAccount(state: State, member: Member, input: Record<string, unknown>, now = new Date()) {
    if (member.role !== 'member' || member.status !== 'Active') throw new Error('Active membership required.');
    if (savedBankAccount(state, member)) throw new Error('A bank account is already saved.');
    member.bankAccount = { ...validateBankDetails(input), savedAt: now.toISOString() };
    audit(state, member.id, 'Bank account saved', { type: 'member', id: member.id });
}
export function policyManager(state: State, actor: Member) {
    if (actor.role !== 'admin' || actor.status !== 'Active') return false;
    if (actor.managesLoanPolicy) return true;
    const admins = state.members.filter(m => m.role === 'admin' && m.status === 'Active');
    return !state.members.some(m => m.managesLoanPolicy) && admins.length === 1 && admins[0].id === actor.id;
}
export function currentOffice(actor: Member): Office {
    if (!administrativeAccess(actor) || !actor.office || !OFFICES.includes(actor.office)) throw new Error('An assigned cooperative office is required.');
    return actor.office;
}
export function quorum(state: State, signatures: { actorId: string; office: Office }[], policy: LoanPolicy | undefined = state.loanPolicy, disbursement = false) {
    if (!policy) return false;
    const valid = signatures.filter(s => state.members.some(m => m.id === s.actorId && administrativeAccess(m) && m.office === s.office));
    const unique = [...new Map(valid.map(s => [s.actorId, s])).values()];
    return policyProgress(policy, unique, disbursement) === 'Complete';
}
export function loanApprovals(state: State, loanId: string, stage?: LoanApproval['stage']) { const cycle = state.loans.find(l => l.id === loanId)?.reviewCycle || 1; return (state.loanApprovals || []).filter(a => a.loanId === loanId && (a.cycle || 1) === cycle && (!stage || a.stage === stage)); }
export function currentLoanApprovals(state: State, loanId: string, stage: LoanApproval['stage']) {
    return loanApprovals(state, loanId, stage).filter(a => a.decision === 'Approved' && state.members.some(m => m.id === a.actorId && administrativeAccess(m) && m.office === a.office));
}
export function referenceInUse(state: State, reference: string, exceptLoanId?: string) {
    return state.transactions.some(t => t.reference === reference) || !!state.loanRepayments?.some(r => r.reference === reference) || state.loans.some(l => l.id !== exceptLoanId && l.pendingDisbursement?.reference === reference);
}
function addApproval(state: State, actor: Member, loan: Loan, stage: LoanApproval['stage'], decision: 'Approved' | 'Rejected', note: string, now: Date) {
    const office = currentOffice(actor);
    if (actor.id === loan.memberId) throw new Error('You cannot review or approve your own loan.');
    if (loanApprovals(state, loan.id, stage).some(a => a.actorId === actor.id && a.office === office)) throw new Error('Your decision for this stage is already recorded.');
    (state.loanApprovals ??= []).push({ id: randomUUID(), loanId: loan.id, actorId: actor.id, office, stage, decision, note, cycle: loan.reviewCycle || 1, createdAt: now.toISOString() });
    audit(state, actor.id, `${stage}: ${decision}; ${note}`, { type: 'loan', id: loan.id });
}
function exceptionFor(state: State, memberId: string) {
    return state.loanExceptions?.find(e => e.memberId === memberId && !e.usedByLoanId && quorum(state, e.signatures || [], e.policySnapshot || state.loanPolicy));
}
export function submitLoan(state: State, member: Member, input: Record<string, unknown>, draft = false, now = new Date()) {
    if (member.role !== 'member' || member.status !== 'Active') throw new Error('Active membership required.');
    const bank = savedBankAccount(state, member);
    if (!bank) throw new Error('Add your bank account before applying for a loan.');
    const existing = input.id ? state.loans.find(l => l.id === input.id && l.memberId === member.id) : state.loans.find(l => l.memberId === member.id && l.status === 'Draft' && !expiredApplication(l, now));
    if (input.id && (!existing || existing.status !== 'Draft')) throw new Error('Only your draft can be edited.');
    if (existing && expiredApplication(existing, now)) throw new Error('This draft is from a closed calendar year. Start a new application.');
    const fields = draft ? { amount: typeof input.amount === 'string' ? input.amount : '', reason: typeof input.reason === 'string' ? input.reason.trim().slice(0, 2000) : '', proposedRepaymentDate: typeof input.proposedRepaymentDate === 'string' ? input.proposedRepaymentDate : '' } : loanRequestSchema.validateSync(input, { stripUnknown: true, context: { now: now.toISOString() } });
    if (draft && fields.proposedRepaymentDate && !validDateKey(fields.proposedRepaymentDate)) throw new Error('Choose a valid repayment date.');
    const amount = fields.amount ? amountInKobo(fields.amount) : 0;
    if (!draft && !amount) throw new Error('Enter a positive amount.');
    const active = state.loans.some(l => l.memberId === member.id && l.id !== existing?.id && (['Approved', 'Awaiting Disbursement'].includes(l.status) || ['Pending', 'Under Review'].includes(l.status) && !expiredApplication(l, now)));
    if (!draft && active) throw new Error('You already have an active application.');
    const exception = exceptionFor(state, member.id);
    const hasOutstanding = member.outstanding > 0 || state.loans.some(l => l.memberId === member.id && loanBalance(l) > 0);
    if (!draft && hasOutstanding && !exception) throw new Error('Settle your outstanding loan or obtain an authorised exception first.');
    const documentId = typeof input.supportingDocumentId === 'string' && input.supportingDocumentId ? input.supportingDocumentId : undefined;
    if (!draft && state.loanPolicy?.documentRequired && !documentId) throw new Error('A supporting document is required.');
    const timestamp = now.toISOString(), year = calendarYear(now);
    const loan: Loan = existing || { id: randomUUID(), memberId: member.id, createdAt: timestamp, queue: 0, period: timestamp.slice(0, 7), amount: 0, reason: '', status: 'Draft' };
    if (!loan.reference) { do { loan.reference = `IKH-EL-${year}-${randomUUID().slice(0, 8).toUpperCase()}`; } while (state.loans.some(l => l.id !== loan.id && l.reference === loan.reference)); }
    Object.assign(loan, { amount, reason: fields.reason, proposedRepaymentDate: fields.proposedRepaymentDate, supportingDocumentId: documentId, status: draft ? 'Draft' : 'Pending', updatedAt: timestamp, expiresAt: yearEnd(now), bankName: bank.bankName, accountName: bank.accountName, accountNumber: bank.accountNumber });
    if (!draft) {
        loan.policySnapshot = state.loanPolicy ? { ...state.loanPolicy } : undefined;
        loan.submittedAt = timestamp; loan.period = `${year}-${now.toLocaleDateString('en-US', { timeZone: 'Africa/Lagos', month: '2-digit' })}`; loan.declarationAcceptedAt = timestamp;
        loan.queue = Math.max(0, ...state.loans.filter(l => calendarYear(new Date(l.submittedAt || l.createdAt)) === year).map(l => l.queue)) + 1;
        if (exception && hasOutstanding) { exception.usedByLoanId = loan.id; loan.exception = { authorizedBy: exception.authorizedBy, note: exception.note, createdAt: exception.createdAt }; }
    }
    member.bankAccount ??= bank;
    if (!existing) state.loans.push(loan);
    audit(state, member.id, draft ? 'Emergency loan draft saved' : 'Emergency loan submitted', { type: 'loan', id: loan.id });
    return loan;
}
export function cancelLoan(state: State, member: Member, id: string, now = new Date()) {
    const loan = state.loans.find(l => l.id === id && l.memberId === member.id);
    if (!loan || !['Draft', 'Pending', 'Under Review', 'Approved', 'Awaiting Disbursement'].includes(loan.status)) throw new Error('This application cannot be cancelled.');
    if (loan.pendingDisbursement) throw new Error('Disbursement verification has started. Contact the cooperative.');
    loan.status = 'Cancelled'; loan.cancelledAt = now.toISOString();
    audit(state, member.id, 'Loan application cancelled', { type: 'loan', id });
}
export function respondToLoanTerms(state: State, member: Member, id: string, accepted: boolean, now = new Date()) {
    if (member.role !== 'member' || member.status !== 'Active') throw new Error('Active membership required.');
    const loan = state.loans.find(l => l.id === id && l.memberId === member.id);
    if (!loan || loan.status !== 'Awaiting Disbursement' || !loan.terms || loan.termsAcceptedAt || loan.pendingDisbursement) throw new Error('No new repayment terms to respond to.');
    if (accepted) loan.termsAcceptedAt = now.toISOString();
    else { loan.termsDeclinedAt = now.toISOString(); loan.status = 'Cancelled'; loan.cancelledAt = now.toISOString(); loan.decisionNote = 'Member declined the repayment terms.'; }
    audit(state, member.id, accepted ? 'Approved repayment terms accepted' : 'Approved repayment terms declined', { type: 'loan', id });
}
export function repaymentSchedule(amount: number, firstDueDate: string, count: number) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate) || !Number.isInteger(count) || count < 1 || count > 120) throw new Error('Choose a first due date and 1–120 monthly installments.');
    const first = new Date(`${firstDueDate}T00:00:00Z`);
    if (!Number.isFinite(first.getTime()) || first.toISOString().slice(0, 10) !== firstDueDate || count > amount) throw new Error('Invalid repayment schedule.');
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(first); date.setUTCDate(1); date.setUTCMonth(first.getUTCMonth() + index);
        const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(); date.setUTCDate(Math.min(first.getUTCDate(), last));
        return { dueDate: date.toISOString().slice(0, 10), amount: Math.floor(amount / count) + (index < amount % count ? 1 : 0) };
    });
}
export function overdueAmount(loan: Loan, now = new Date()) {
    if (!['Disbursed', 'Repaying'].includes(loan.status) || !loan.terms) return 0;
    const due = loan.terms.installments.filter(i => new Date(`${i.dueDate}T23:59:59.999+01:00`) < now).reduce((sum, i) => sum + i.amount, 0);
    return Math.max(0, due - (loan.repaid || 0));
}
export function recordRepayment(state: State, actor: Member, input: Record<string, unknown>, now = new Date()) {
    const office = currentOffice(actor);
    if (!['Treasurer', 'Financial Secretary'].includes(office)) throw new Error('A Signatory-B official must record repayments.');
    const fields = yup.object({ loanId: text('Loan'), amount: text('Amount', 30), reference: text('Reference', 100), description: text('Description', 500) }).validateSync(input, { stripUnknown: true });
    const loan = state.loans.find(l => l.id === fields.loanId && ['Disbursed', 'Repaying'].includes(l.status));
    if (!loan) throw new Error('Choose a disbursed loan.');
    const member = state.members.find(m => m.id === loan.memberId);
    if (!member) throw new Error('Member not found.');
    const amount = amountInKobo(fields.amount);
    if (amount > loanBalance(loan)) throw new Error('Repayment exceeds this loan’s outstanding balance.');
    if (referenceInUse(state, fields.reference)) throw new Error('Reference already recorded.');
    applyLoanRepayment(state, loan, amount, fields.reference, actor.id, fields.description, now);
}

/** Shared ledger operation; callers must first authorize the official or verify the gateway payment. */
export function applyLoanRepayment(state: State, loan: Loan, amount: number, reference: string, recordedBy: string, description: string, now = new Date()) {
    const member = state.members.find(m => m.id === loan.memberId);
    if (!member || !Number.isSafeInteger(amount) || amount <= 0 || amount > loanBalance(loan)) throw new Error('Invalid loan repayment amount.');
    if (referenceInUse(state, reference)) throw new Error('Reference already recorded.');
    loan.repaid = (loan.repaid || 0) + amount;
    loan.status = loan.repaid === loanRepaymentTotal(loan) ? 'Completed' : 'Repaying';
    member.outstanding = Math.max(0, member.outstanding - amount);
    const timestamp = now.toISOString();
    (state.loanRepayments ??= []).push({ id: randomUUID(), loanId: loan.id, memberId: member.id, amount, reference: reference, date: timestamp, recordedBy });
    state.transactions.push({ id: randomUUID(), memberId: member.id, loanId: loan.id, amount, type: 'Loan repayment', description: description, reference: reference, status: 'Completed', date: timestamp });
    audit(state, recordedBy, `Loan repayment: ${amount} kobo; ${reference}`, { type: 'loan', id: loan.id });
}

export function loanAdminAction(state: State, actor: Member, input: Record<string, unknown>, now = new Date()) {
    const timestamp = now.toISOString();
    if (input.action === 'loan-policy') {
        if (!policyManager(state, actor)) throw new Error('Loan policy manager access required.');
        const explicitOffices = input.approvalOffices !== undefined || input.disbursementOffices !== undefined;
        const selections = explicitOffices ? yup.object({ approvalOffices: yup.array().of(yup.string().oneOf(OFFICES).required()).min(1, 'Select at least one loan approver.').required(), disbursementOffices: yup.array().of(yup.string().oneOf(OFFICES).required()).min(1, 'Select at least one transfer approver.').required() }).validateSync(input) : undefined;
        const fields = yup.object({ approvalCombination: yup.string().oneOf(APPROVAL_COMBINATIONS).required(), disbursementCombination: yup.string().oneOf(APPROVAL_COMBINATIONS).optional(), documentRequired: yup.boolean().required() }).validateSync(selections ? { ...input, approvalCombination: 'All four', disbursementCombination: 'All four' } : input);
        for (const loan of state.loans) if (loan.status !== 'Draft' && !loan.policySnapshot && state.loanPolicy) loan.policySnapshot = { ...state.loanPolicy };
        for (const exception of state.loanExceptions || []) if (!exception.policySnapshot && state.loanPolicy) exception.policySnapshot = { ...state.loanPolicy };
        state.loanPolicy = { ...(selections ? { approvalOffices: [...new Set(selections.approvalOffices)] as Office[], disbursementOffices: [...new Set(selections.disbursementOffices)] as Office[] } : {}), approvalCombination: fields.approvalCombination as LoanPolicy['approvalCombination'], disbursementCombination: (fields.disbursementCombination || fields.approvalCombination) as LoanPolicy['approvalCombination'], documentRequired: fields.documentRequired, configuredAt: timestamp };
        actor.managesLoanPolicy = true;
        audit(state, actor.id, `Loan policy configured: ${policyLabel(state.loanPolicy)}; transfer verification ${policyLabel(state.loanPolicy, true)}; supporting documents ${fields.documentRequired ? 'required' : 'optional'}`); return;
    }
    if (input.action === 'loan-office') {
        if (!policyManager(state, actor)) throw new Error('Loan policy manager access required.');
        const fields = yup.object({ memberId: text('Official'), office: yup.string().oneOf([...OFFICES, 'None']).required() }).validateSync(input);
        const official = state.members.find(m => m.id === fields.memberId && m.status === 'Active');
        if (!official) throw new Error('Choose an active account.');
        if (fields.office !== 'None' && state.members.some(m => m.id !== official.id && m.office === fields.office)) throw new Error('This office is already assigned.');
        actor.managesLoanPolicy = true;
        if (fields.office === 'None') delete official.office; else { official.office = fields.office as Office; }
        audit(state, actor.id, `${fields.office} assigned to ${official.name}`); return;
    }
    const office = currentOffice(actor);
    if (input.action === 'loan-exception') {
        if (!state.loanPolicy) throw new Error('Configure the signatory policy first.');
        const fields = yup.object({ memberId: text('Member'), note: text('Exception reason') }).validateSync(input);
        const member = state.members.find(m => m.id === fields.memberId && m.role === 'member' && m.status === 'Active');
        if (!member || member.id === actor.id) throw new Error('Choose an active member.');
        let exception = state.loanExceptions?.find(e => e.memberId === member.id && !e.usedByLoanId);
        const exceptionPolicy = exception?.policySnapshot || state.loanPolicy;
        if (!policyEligible(exceptionPolicy, office)) throw new Error('Your signatory group is not authorized for this exception.');
        if (exception?.signatures?.some(s => s.actorId === actor.id)) throw new Error('Your exception authorisation is already recorded.');
        if (!exception) { exception = { policySnapshot: { ...exceptionPolicy }, id: randomUUID(), memberId: member.id, authorizedBy: actor.id, note: fields.note, createdAt: timestamp, signatures: [] }; (state.loanExceptions ??= []).push(exception); }
        exception.signatures!.push({ actorId: actor.id, office });
        audit(state, actor.id, `Outstanding-loan exception signed: ${fields.note}`, { type: 'member', id: member.id }); return;
    }
    const id = text('Loan').validateSync(input.id);
    const loan = state.loans.find(l => l.id === id);
    if (!loan || loan.status === 'Draft') throw new Error('Submitted application not found.');
    if (actor.id === loan.memberId) throw new Error('You cannot review your own loan.');
    const member = state.members.find(m => m.id === loan.memberId);
    if (!member) throw new Error('Member not found.');
    const policy = loan.policySnapshot || state.loanPolicy;
    if (!loan.policySnapshot && policy) loan.policySnapshot = { ...policy };
    if (input.action === 'loan-reopen') {
        if (!canManageLoanTerms(policy, office) || !['Approved', 'Awaiting Disbursement'].includes(loan.status) || loan.pendingDisbursement) throw new Error('This approval cannot be reopened.');
        const note = text('Reassessment reason').validateSync(input.note);
        if (loan.terms) (loan.termsHistory ??= []).push(loan.terms);
        delete loan.terms; delete loan.termsAcceptedAt;
        loan.reviewCycle = (loan.reviewCycle || 1) + 1; loan.status = 'Under Review'; loan.expiresAt = yearEnd(now);
        audit(state, actor.id, `Loan approval reopened: ${note}`, { type: 'loan', id }); return;
    }
    if (input.action === 'loan-renew') {
        if (office !== 'Secretary General' || !expiredApplication(loan, now)) throw new Error('Only the Secretary General can renew an expired queue entry.');
        const note = text('Renewal reason').validateSync(input.note);
        loan.expiresAt = yearEnd(now); loan.status = 'Pending'; loan.updatedAt = timestamp; loan.reviewCycle = (loan.reviewCycle || 1) + 1;
        loan.queue = Math.max(0, ...state.loans.filter(l => l.id !== id && !expiredApplication(l, now)).map(l => l.queue)) + 1;
        audit(state, actor.id, `Queue entry renewed: ${note}`, { type: 'loan', id }); return;
    }
    if (input.action === 'loan-confirm-approval') {
        if (!['Approved', 'Awaiting Disbursement'].includes(loan.status) || !policyEligible(policy, office)) throw new Error('Only a selected approver can confirm an unfunded approval.');
        if (quorum(state, currentLoanApprovals(state, id, 'Approval'), policy)) throw new Error('Current approval is already complete.');
        if (member.status !== 'Active') throw new Error('Active membership required.');
        if (!policy?.approvalOffices && !['Financial review', 'Availability review'].every(stage => currentLoanApprovals(state, id, stage as LoanApproval['stage']).length)) throw new Error('Reopen review to refresh the financial reviews first.');
        addApproval(state, actor, loan, 'Approval', 'Approved', text('Confirmation reason').validateSync(input.note), now);
        return;
    }
    if (['loan-start-review', 'loan-financial-review', 'loan-review'].includes(String(input.action))) {
        if (!['Pending', 'Under Review'].includes(loan.status)) throw new Error('This application is not awaiting review.');
        if (expiredApplication(loan, now)) throw new Error('The calendar-year queue is closed. Historical records are retained.');
        if (input.action === 'loan-start-review') { loan.status = 'Under Review'; audit(state, actor.id, 'Loan review started', { type: 'loan', id }); return; }
        const fields = yup.object({ decision: yup.string().oneOf(['Approved', 'Rejected']).required(), note: text('Decision reason') }).validateSync(input);
        const decision = fields.decision as 'Approved' | 'Rejected';
        let stage: LoanApproval['stage'] = 'Approval';
        if (input.action === 'loan-financial-review') {
            if (office === 'Financial Secretary') stage = 'Financial review';
            else if (office === 'Treasurer') {
                if (!currentLoanApprovals(state, id, 'Financial review').length) throw new Error('Financial Secretary review is required first.');
                stage = 'Availability review';
            } else throw new Error('Only the Financial Secretary or Treasurer can complete financial reviews.');
        }
        if (decision === 'Approved') {
            if (member.status !== 'Active') throw new Error('Active membership required.');
            if (member.outstanding > 0 && !loan.exception) throw new Error('An outstanding-loan exception is required.');
            if (stage === 'Approval') {
                if (!policy) throw new Error('Configure the signatory policy first.');
                if (!policy.approvalOffices && !['Financial review', 'Availability review'].every(s => currentLoanApprovals(state, id, s as LoanApproval['stage']).length > 0)) throw new Error('Financial Secretary and Treasurer reviews are required first.');
            }
        }
        if (stage === 'Approval' && (!policy || !policyEligible(policy, office))) throw new Error('Your signatory group is not authorized by this loan approval policy.');
        addApproval(state, actor, loan, stage, decision, fields.note, now);
        loan.status = decision === 'Rejected' ? 'Rejected' : 'Under Review';
        loan.reviewedAt = timestamp; loan.decisionNote = fields.note;
        if (stage === 'Approval' && decision === 'Approved' && quorum(state, loanApprovals(state, id, 'Approval').filter(a => a.decision === 'Approved'), policy)) loan.status = 'Approved';
        return;
    }
    if (input.action === 'loan-terms') {
        if (!canManageLoanTerms(policy, office)) throw new Error(policy?.approvalOffices ? 'Only a selected loan approver can record repayment terms.' : 'The Secretary General records the management decision and terms.');
        if (loan.status !== 'Approved' || !quorum(state, loanApprovals(state, id, 'Approval').filter(a => a.decision === 'Approved'), policy)) throw new Error('The required signatories must approve first.');
        const fields = yup.object({ approvedAmount: text('Approved amount', 30), repaymentTerms: yup.string().trim().max(2000).default(''), firstDueDate: text('First due date'), installments: yup.number().integer().min(1).max(120).required() }).validateSync(input);
        const amount = amountInKobo(fields.approvedAmount);
        if (amount > loan.amount) throw new Error('Approved amount cannot exceed the requested amount.');
        if (!loan.bankName || !loan.accountNumber || !loan.accountName) { const bank = savedBankAccount(state, member); if (!bank) throw new Error('The member must save a bank account first.'); Object.assign(loan, { bankName: bank.bankName, accountName: bank.accountName, accountNumber: bank.accountNumber }); }
        const interest = calculateLoanInterest(amount, input.interestRate === undefined ? '0' : input.interestRate);
        const schedule = repaymentSchedule(interest.totalRepayment, fields.firstDueDate, fields.installments);
        if (new Date(`${fields.firstDueDate}T23:59:59.999+01:00`) <= now) throw new Error('The first due date must be in the future.');
        loan.terms = { ...interest, approvedAmount: amount, repaymentTerms: fields.repaymentTerms || (fields.installments === 1 ? `Repayment due ${fields.firstDueDate}` : `${fields.installments} monthly installments starting ${fields.firstDueDate}`), installments: schedule, recordedBy: actor.id, recordedAt: timestamp };
        loan.status = 'Awaiting Disbursement';
        audit(state, actor.id, `Management decision recorded: ${amount} kobo; ${interest.interestRate}% flat interest; total ${interest.totalRepayment} kobo; ${fields.installments} installments`, { type: 'loan', id }); return;
    }
    if (input.action === 'loan-disburse') {
        if (loan.status !== 'Awaiting Disbursement' || !loan.terms) throw new Error('Record approved repayment terms first.');
        if (!quorum(state, loanApprovals(state, id, 'Approval').filter(a => a.decision === 'Approved'), policy)) throw new Error('Current approval signatories do not satisfy the policy. Reopen review first.');
        validateBankDetails({ bankName: loan.bankName, accountName: loan.accountName, accountNumber: loan.accountNumber });
        if (!loan.termsAcceptedAt) throw new Error('The member must accept the repayment terms first.');
        if (member.status !== 'Active') throw new Error('Active membership required.');
        const fields = yup.object({ reference: text('Transfer reference', 100), date: text('Transfer date') }).validateSync(input);
        const transferDate = new Date(fields.date);
        if (!Number.isFinite(transferDate.getTime()) || transferDate > now) throw new Error('Enter a valid completed transfer date.');
        if (referenceInUse(state, fields.reference, id)) throw new Error('Reference already recorded.');
        if (loan.pendingDisbursement && (loan.pendingDisbursement.reference !== fields.reference || loan.pendingDisbursement.date !== transferDate.toISOString())) throw new Error('All signatories must verify the same transfer details.');
        if (!policy || !policyEligible(policy, office, true)) throw new Error('Your signatory group is not authorized to verify this transfer.');
        addApproval(state, actor, loan, 'Disbursement', 'Approved', `Transfer ${fields.reference} verified`, now);
        loan.pendingDisbursement ??= { reference: fields.reference, date: transferDate.toISOString() };
        if (quorum(state, loanApprovals(state, id, 'Disbursement'), policy, true)) {
            loan.status = 'Disbursed'; loan.disbursedAt = transferDate.toISOString(); loan.repaid = 0;
            loan.disbursement = { ...loan.pendingDisbursement, recordedBy: actor.id, verifiedAt: timestamp };
            member.outstanding += loanRepaymentTotal(loan);
            state.transactions.push({ id: randomUUID(), memberId: member.id, loanId: loan.id, date: transferDate.toISOString(), type: 'Loan disbursement', amount: loan.terms.approvedAmount, description: 'Emergency loan disbursement', reference: fields.reference, status: 'Completed' });
            audit(state, actor.id, `Loan disbursed: ${loan.terms.approvedAmount} kobo; ${fields.reference}`, { type: 'loan', id });
        }
        return;
    }
    throw new Error('Invalid loan action.');
}
