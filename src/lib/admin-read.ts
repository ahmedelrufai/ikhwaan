import { paginate } from './pagination.ts';
import { repaymentDashboard } from './repayment-dates.ts';
import { policyManager, normalizedLoanStatus, expiredApplication, savedBankAccount, overdueAmount } from './loans.ts';
import { electionView } from './admin.ts';
import { loanEmailConfiguration } from './loan-email-delivery.ts';
import { activityLoanId } from './activity-loan.ts';
import { publicMember, type Loan, type Member, type State, type StateField } from './store.ts';
export type AdminPageMeta = Omit<ReturnType<typeof paginate>, 'items'>;
export type LoanSummary = {
    total: number;
    review: number;
    approved: number;
    awaitingDisbursement: number;
    repaying: number;
    requested: number;
    approvedAmount: number;
    disbursed: number;
    outstanding: number;
    overdue: number;
};
export const ADMIN_READ_FIELDS = {
    overview: ['members', 'loans', 'audit'], members: ['members'], 'member-details': ['members', 'loans', 'transactions'],
    loans: ['members', 'loans'], 'loan-details': ['members', 'loans', 'transactions', 'loanPolicy', 'loanApprovals', 'loanRepayments'],
    repayments: ['members', 'loans'], 'loan-settings': ['members', 'loanPolicy', 'loanExceptions', 'loanEmails'],
    transactions: ['members', 'transactions'], 'new-transaction': ['members'], withdrawals: ['members', 'withdrawals'],
    payments: ['members', 'payments', 'paymentSettings'], 'payment-settings': ['members', 'paymentSettings'],
    dividends: ['members', 'dividends'], 'new-dividend': ['members'], elections: ['members', 'elections'], 'new-election': ['members'],
    announcements: ['members', 'announcements'], 'new-announcement': ['members'], audit: ['members', 'audit', 'loans'],
} satisfies Record<string, StateField[]>;
export type AdminReadSection = keyof typeof ADMIN_READ_FIELDS | 'all';
export function adminReadSection(value: string | null): AdminReadSection {
    if (!value || value === 'all')
        return 'all';
    if (!Object.hasOwn(ADMIN_READ_FIELDS, value))
        throw new Error('Unknown administration section.');
    return value as AdminReadSection;
}
const summaryMember = (member: Member) => ({ id: member.id, number: member.number, name: member.name, email: member.email, phone: member.phone, role: member.role, status: member.status, office: member.office, outstanding: member.outstanding, profileStatus: member.profileStatus }) as ReturnType<typeof publicMember>;
const normalized = (loan: Loan) => ({ ...loan, status: normalizedLoanStatus(loan), queueClosed: expiredApplication(loan), overdue: overdueAmount(loan) });
export function adminSnapshot(state: State, actor: Member, query: URLSearchParams) {
    const section = adminReadSection(query.get('section')), all = section === 'all';
    const wants = (...sections: AdminReadSection[]) => all || sections.includes(section);
    const search = (query.get('search') || '').trim().slice(0, 500).toLowerCase(), status = query.get('status') || 'All', id = query.get('id');
    const page = Number(query.get('page') || 1), pageSize = [10, 25, 50].includes(Number(query.get('pageSize'))) ? Number(query.get('pageSize')) : 10;
    const memberMap = new Map(state.members.map(member => [member.id, member]));
    const members = state.members.filter(member => member.role === 'member' && member.profileStatus !== 'Incomplete');
    const loans = state.loans.filter(loan => loan.status !== 'Draft');
    const officialRecords = state.members.filter(member => member.role === 'admin' || member.office);
    const lookupName = (id: string) => memberMap.get(id)?.name || '';
    const matches = (text: string) => text.toLowerCase().includes(search);
    let pageMeta: AdminPageMeta | undefined;
    const slice = <T>(rows: T[]) => { const { items, ...meta } = paginate(rows, page, pageSize); pageMeta = meta; return items; };
    let selectedMembers = wants('members', 'loan-settings', 'new-transaction', 'new-dividend', 'withdrawals', 'transactions', 'payments', 'dividends', 'repayments', 'overview', 'audit') ? members : [];
    let selectedLoans: Loan[] = all ? loans : [];
    let activities = wants('overview', 'audit') ? [...state.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
    let loanSummary: LoanSummary | undefined;
    if (section === 'members')
        selectedMembers = slice(members.filter(member => matches(`${member.name} ${member.email} ${member.number} ${member.phone}`) && (status === 'All' || member.status === status)));
    if (section === 'member-details')
        selectedMembers = members.filter(member => member.id === id);
    if (section === 'loans') {
        const rows = loans.map(normalized);
        loanSummary = {
            total: rows.length, review: rows.filter(loan => ['Pending', 'Under Review'].includes(loan.status) && !loan.queueClosed).length,
            approved: rows.filter(loan => loan.status === 'Approved').length, awaitingDisbursement: rows.filter(loan => loan.status === 'Awaiting Disbursement').length,
            repaying: rows.filter(loan => ['Disbursed', 'Repaying'].includes(loan.status)).length,
            requested: rows.reduce((sum, loan) => sum + loan.amount, 0), approvedAmount: rows.reduce((sum, loan) => sum + (loan.terms?.approvedAmount || 0), 0),
            disbursed: rows.filter(loan => ['Disbursed', 'Repaying', 'Completed'].includes(loan.status)).reduce((sum, loan) => sum + (loan.terms?.approvedAmount || loan.amount), 0),
            outstanding: members.reduce((sum, member) => sum + member.outstanding, 0), overdue: rows.reduce((sum, loan) => sum + loan.overdue, 0),
        };
        selectedLoans = slice(rows.filter(loan => {
            const member = memberMap.get(loan.memberId);
            const statusMatches = status === 'All' || (status === 'Review queue' ? ['Pending', 'Under Review'].includes(loan.status) && !loan.queueClosed : status === 'Active repayments' ? ['Disbursed', 'Repaying'].includes(loan.status) : loan.status === status);
            return statusMatches && matches(`${member?.name || ''} ${member?.number || ''} ${loan.id} ${loan.reference || ''} ${loan.reason} ${loan.status}`);
        }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        const ids = new Set(selectedLoans.map(loan => loan.memberId));
        selectedMembers = members.filter(member => ids.has(member.id));
    }
    if (section === 'loan-details') {
        selectedLoans = loans.filter(loan => loan.id === id);
        selectedMembers = members.filter(member => selectedLoans.some(loan => loan.memberId === member.id));
    }
    if (section === 'overview') {
        activities = activities.slice(0, 5);
        selectedLoans = loans.filter(loan => ['Pending', 'Under Review'].includes(loan.status));
    }
    if (section === 'audit')
        activities = slice(activities.filter(activity => matches(`${activity.action} ${activity.actor} ${lookupName(activity.actor)}`)));
    if (section === 'audit' || section === 'overview') {
        const linked = new Set(activities.map(activity => activityLoanId(activity, loans)).filter(Boolean));
        // Keep only the minimal records needed to resolve links from this page of activities.
        const related = loans.filter(loan => linked.has(loan.id) && !selectedLoans.some(selected => selected.id === loan.id));
        selectedLoans = [...selectedLoans, ...related];
    }
    const currentLoan = section === 'loan-details' ? selectedLoans[0] : undefined;
    const includeBank = all || section === 'member-details' || section === 'loan-details';
    const repayment = repaymentDashboard(wants('overview', 'repayments') ? loans : []);
    if (section === 'overview')
        repayment.rows = repayment.rows.slice(0, 5);
    return {
        section, recordId: id || undefined, pageMeta, memberTotal: members.length, loanSummary,
        actor: publicMember(actor), loanPolicyManager: policyManager(state, actor),
        officials: wants('loan-details', 'loan-settings', 'audit', 'overview') ? officialRecords.map(member => all || section === 'loan-details' || section === 'loan-settings' ? publicMember(member) : summaryMember(member)) : [],
        members: selectedMembers.map(member => includeBank ? { ...publicMember(member), bankAccount: savedBankAccount(state, member) } : summaryMember(member)),
        loans: selectedLoans.map(loan => {
            const result = normalized(loan);
            if (all || section === 'loan-details')
                return result;
            // Registers do not need documents, bank details, installment schedules or approval history.
            const { terms, termsHistory, bankName, accountName, accountNumber, supportingDocumentId, policySnapshot, pendingDisbursement, ...row } = result;
            void termsHistory;
            void bankName;
            void accountName;
            void accountNumber;
            void supportingDocumentId;
            void policySnapshot;
            void pendingDisbursement;
            return { ...row, terms: terms ? { approvedAmount: terms.approvedAmount } as typeof terms : undefined };
        }),
        repaymentDashboard: repayment,
        transactions: wants('transactions') ? state.transactions : section === 'member-details' ? state.transactions.filter(transaction => transaction.memberId === id) : currentLoan ? state.transactions.filter(transaction => transaction.memberId === currentLoan.memberId) : [],
        loanApprovals: all ? state.loanApprovals || [] : currentLoan ? (state.loanApprovals || []).filter(approval => approval.loanId === currentLoan.id) : [],
        loanRepayments: all ? state.loanRepayments || [] : currentLoan ? (state.loanRepayments || []).filter(repayment => repayment.loanId === currentLoan.id) : [],
        loanExceptions: wants('loan-settings') ? state.loanExceptions || [] : [], loanPolicy: wants('loan-details', 'loan-settings') ? state.loanPolicy : undefined,
        loanEmailStatus: wants('loan-settings') && policyManager(state, actor) ? { configured: !!loanEmailConfiguration(), pending: (state.loanEmails || []).filter(email => ['Pending', 'Sending'].includes(email.status)).length, failed: (state.loanEmails || []).filter(email => email.status === 'Pending' && email.lastError).length, sent: (state.loanEmails || []).filter(email => email.status === 'Sent').length } : undefined,
        paymentSettings: wants('payments', 'payment-settings') ? state.paymentSettings || { enabled: process.env.PAYMENTS_APPROVED === 'true', membershipFee: Number(process.env.MEMBERSHIP_FEE_KOBO) || 0 } : undefined,
        paymentProviderConfigured: !!process.env.PAYSTACK_SECRET_KEY, payments: wants('payments') ? state.payments || [] : [],
        withdrawals: wants('withdrawals') ? state.withdrawals : [], announcements: wants('announcements') ? state.announcements : [],
        dividends: wants('dividends') ? state.dividends || [] : [], elections: wants('elections') ? (state.elections || []).map(election => electionView(election)) : [], audit: activities,
    };
}
