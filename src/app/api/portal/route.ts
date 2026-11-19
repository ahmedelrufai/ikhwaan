import { after } from 'next/server';
import { loanEmailTasks, queueLoanEmails } from '@/lib/loan-notifications';
import { deliverLoanEmails } from '@/lib/loan-email-delivery';
import { respondToLoanTerms, submitLoan, saveBankAccount, savedBankAccount, cancelLoan, normalizedLoanStatus, expiredApplication } from '@/lib/loans';
import { findDocument } from '@/lib/loan-documents';
import { validateBankDetails } from '@/lib/bank-details';
import { accountDestination, memberDashboardAllowed } from '@/lib/access';
import { csvResponse } from '@/lib/csv';
import { normalizePhone, validateRegistration } from '@/lib/registration';
import { contributionPlans } from '@/lib/contributions';
import { paymentConfiguration } from '@/lib/payments';
import { castVote, electionView } from '@/lib/admin';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { currentMember, sameOrigin, rateLimit } from '@/lib/auth';
import { audit, publicMember, withState } from '@/lib/store';
import { amountInKobo, noticeEnd } from '@/lib/rules';
export async function GET(request: Request) { const member = await currentMember(); if (!member)
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 }); if (member.role !== 'member') return NextResponse.json({ error: 'Use the admin workspace.' }, { status: 403 }); if (!memberDashboardAllowed(member)) return NextResponse.json({ error: 'Membership approval required.', redirectTo: accountDestination(member) }, { status: 403 }); return withState(state => { const current = state.members.find(m => m.id === member.id); if (!current || !memberDashboardAllowed(current)) return NextResponse.json({ error: 'Membership approval required.', redirectTo: accountDestination(current || member) }, { status: 403 }); const transactions = state.transactions.filter(t => t.memberId === member.id); if (new URL(request.url).searchParams.get('export') === 'statement') {
    const rows = [['Date', 'Description', 'Type', 'Amount (NGN)', 'Status'], ...transactions.map(t => [t.date, t.description, t.type, (t.amount / 100).toFixed(2), t.status])];
    return csvResponse(rows, 'ikhwaan-statement.csv');
} return NextResponse.json({ member: { ...publicMember(current), bankAccount: savedBankAccount(state, current) }, payments: (state.payments || []).filter(p => p.memberId === member.id), loanRepaymentsEnabled: paymentConfiguration(state).enabled && !!process.env.PAYSTACK_SECRET_KEY, paymentsEnabled: paymentConfiguration(state).enabled && !!process.env.PAYSTACK_SECRET_KEY && paymentConfiguration(state).amount > 0, membershipFee: paymentConfiguration(state).amount || 0, contributionPlans: contributionPlans(state), balancePaymentsEnabled: paymentConfiguration(state).enabled && !!process.env.PAYSTACK_SECRET_KEY, transactions, loanPolicy: state.loanPolicy ? { documentRequired: state.loanPolicy.documentRequired } : { documentRequired: false }, loanRepayments: (state.loanRepayments || []).filter(r => r.memberId === member.id), loanApprovals: (state.loanApprovals || []).filter(a => state.loans.some(l => l.id === a.loanId && l.memberId === member.id)), loans: state.loans.filter(l => l.memberId === member.id).map(l => ({ ...l, status: normalizedLoanStatus(l), queueClosed: expiredApplication(l) })), withdrawals: state.withdrawals.filter(w => w.memberId === member.id), announcements: state.announcements, dividends: (state.dividends || []).filter(d => d.memberId === member.id), elections: (state.elections || []).map(e => electionView(e, member.id)) }, { headers: { 'Cache-Control': 'no-store' } }); }, false, ['members', 'transactions', 'loans', 'payments', 'paymentSettings', 'contributionPlans', 'loanPolicy', 'loanRepayments', 'loanApprovals', 'withdrawals', 'announcements', 'dividends', 'elections']); }
export async function POST(request: Request) { if (!sameOrigin(request))
    return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 }); const actor = await currentMember(); if (!actor)
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 }); if (actor.role !== 'member') return NextResponse.json({ error: 'Use the admin workspace.' }, { status: 403 }); if (!memberDashboardAllowed(actor)) return NextResponse.json({ error: 'Membership approval required.', redirectTo: '/application-status' }, { status: 403 }); try {
    const body = await request.json();
    if (body.supportingDocumentId) {
        const file = await findDocument(String(body.supportingDocumentId));
        if (!file || file.metadata.memberId !== actor.id) throw new Error('Choose your own supporting document.');
    }
    await withState(state => { const notify = typeof body.action === 'string' && (body.action.startsWith('loan') || body.action === 'cancel-loan'); const before = notify ? loanEmailTasks(state) : []; const member = state.members.find(m => m.id === actor.id); if (!member || !memberDashboardAllowed(member)) throw new Error('Membership approval required.'); const now = new Date(); const reason = String(body.reason || '').trim(); switch (body.action) {
        case 'profile': {
            const fields = validateRegistration(body);
            if (state.members.some(m => m.id !== member.id && normalizePhone(m.phone) === fields.phone)) throw new Error('Phone already registered.');
            Object.assign(member, fields);
            const profile = state.memberProfiles?.find(p => p.memberId === member.id);
            if (profile) {
                const { kinName, kinRelationship, kinAddress, kinPhone, kinEmail, ...personal } = fields;
                profile.personal = personal; profile.nextOfKin = { kinName, kinRelationship, kinAddress, kinPhone, kinEmail }; profile.updatedAt = now.toISOString();
            }
            audit(state, member.id, 'Profile updated', { type: 'member', id: member.id });
            break;
        }
        case 'bank-account': { saveBankAccount(state, member, body, now); break; }
        case 'loan':
        case 'loan-draft': { submitLoan(state, member, body, body.action === 'loan-draft', now); break; }
        case 'cancel-loan': { cancelLoan(state, member, String(body.id || ''), now); break; }
        case 'loan-accept-terms':
        case 'loan-decline-terms': {
            if (body.action === 'loan-accept-terms' && body.accepted !== true) throw new Error('Confirm that you accept the repayment terms.');
            respondToLoanTerms(state, member, String(body.id || ''), body.action === 'loan-accept-terms', now);
            break;
        }
        case 'withdraw': {
            if (member.status !== 'Active') throw new Error('Active membership required.');
            if (member.outstanding > 0)
                throw new Error('Settle your loan before withdrawing.');
            if (state.withdrawals.some(w => w.memberId === actor.id && w.status === 'Pending'))
                throw new Error('You have a pending withdrawal request.');
            if (!reason || reason.length > 2000)
                throw new Error('Enter a reason (maximum 2,000 characters).');
            state.withdrawals.push({ id: randomUUID(), memberId: actor.id, reason, createdAt: now.toISOString(), eligibleAt: noticeEnd(now), status: 'Pending' });
            audit(state, actor.id, 'Three-month withdrawal notice submitted');
            break;
        }
        case 'vote': {
            castVote(state, member, String(body.electionId || ''), String(body.candidateId || ''));
            break;
        }
        default: throw new Error('Action unavailable.');
    }
    if (notify) queueLoanEmails(state, before);
    }, true);
    if (typeof body.action === 'string' && (body.action.startsWith('loan') || body.action === 'cancel-loan')) after(async () => { try { await deliverLoanEmails(); } catch { console.error('Loan email worker failed; pending messages remain queued.'); } });
    return NextResponse.json({ ok: true });
}
catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save.' }, { status: 400 });
} }
