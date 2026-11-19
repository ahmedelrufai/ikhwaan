import { saveContributionPlan } from './contributions.ts';
import { administrativeAccess } from './access.ts';
import { loanAdminAction, recordRepayment, currentOffice, loanBalance, referenceInUse } from './loans.ts';
import { randomUUID } from 'node:crypto';
import * as yup from 'yup';
import { audit, type Member, type State } from './store.ts';
import { amountInKobo } from './rules.ts';

const text = (max = 500) => yup.string().trim().required().max(max);
const schemas = {
    'payment-settings': yup.object({ amount: text(), enabled: yup.boolean().required(), contributionAmount: yup.string().trim().optional() }),
    'member-review': yup.object({ id: text(), status: text().oneOf(['Active', 'Suspended', 'Rejected']) }),
    transaction: yup.object({ memberId: text(), type: text().oneOf(['Savings', 'Contribution', 'Loan repayment']), amount: text(), description: text(), reference: text(100) }),
    'withdrawal-review': yup.object({ id: text(), decision: text().oneOf(['Approved', 'Rejected']), note: text(2000) }),
    announcement: yup.object({ title: text(150), body: text(5000) }),
    'announcement-delete': yup.object({ id: text() }),
    dividend: yup.object({ memberId: text(), amount: text(), period: text(80) }),
    election: yup.object({ title: text(150), startsAt: text(), endsAt: text(), candidates: yup.array().of(text(150)).min(2).max(30).required() }),
    'election-publish': yup.object({ id: text() }),
    'election-cancel': yup.object({ id: text() }),
};
export function adminAction(state: State, actor: Member, input: Record<string, unknown>, now = new Date()) {
    if (!administrativeAccess(actor)) throw new Error('Administrator access required.');
    if (input.action === 'contribution-save') { saveContributionPlan(state, actor, input, now); return; }
    if (typeof input.action === 'string' && input.action.startsWith('loan-')) { loanAdminAction(state, actor, input, now); return; }
    if (input.action === 'transaction' && input.type === 'Loan repayment') { recordRepayment(state, actor, input, now); return; }
    const action = input.action as keyof typeof schemas;
    if (typeof action !== 'string' || !Object.hasOwn(schemas, action)) throw new Error('Invalid action.');
    const parse = <K extends keyof typeof schemas>(key: K) => schemas[key].validateSync(input, { stripUnknown: true }) as yup.InferType<(typeof schemas)[K]>;
    const timestamp = now.toISOString();
    const memberFor = (id: string) => {
        const member = state.members.find(m => m.id === id && m.role === 'member');
        if (!member) throw new Error('Member not found.');
        return member;
    };
    const uniqueReference = (reference: string) => {
        if (referenceInUse(state, reference)) throw new Error('Reference already recorded.');
    };
    switch (action) {
        case 'payment-settings': {
            const body = parse('payment-settings');
            state.paymentSettings = { enabled: body.enabled, membershipFee: amountInKobo(body.amount), contributionAmount: body.contributionAmount === undefined ? state.paymentSettings?.contributionAmount || 0 : body.contributionAmount ? amountInKobo(body.contributionAmount) : 0 };
            audit(state, actor.id, `Membership fee: ${state.paymentSettings.membershipFee} kobo; contribution ${state.paymentSettings.contributionAmount} kobo; payments ${body.enabled ? 'enabled' : 'disabled'}`);
            break;
        }
        case 'member-review': {
            const body = parse('member-review');
            const member = memberFor(body.id);
            if (member.profileStatus === 'Incomplete') throw new Error('The member must submit their complete profile before review.');
            if (member.status === 'Withdrawn') throw new Error('Withdrawn membership cannot be reactivated.');
            if (member.status === body.status) throw new Error('Status is unchanged.');
            member.status = body.status;
            audit(state, actor.id, `Member ${member.number}: ${body.status}`, { type: 'member', id: member.id });
            break;
        }
        case 'transaction': {
            const body = parse('transaction');
            if (!['Treasurer', 'Financial Secretary'].includes(currentOffice(actor))) throw new Error('A Signatory-B official must record financial transactions.');
            const member = memberFor(body.memberId);
            if (member.status !== 'Active') throw new Error('Active membership required.');
            const amount = amountInKobo(body.amount);
            uniqueReference(body.reference);
            state.transactions.push({ id: randomUUID(), memberId: member.id, date: timestamp, type: body.type, amount, description: body.description, reference: body.reference, status: 'Completed' });
            audit(state, actor.id, `${body.type}: ${amount} kobo for ${member.number}; reference ${body.reference}`);
            break;
        }
        case 'withdrawal-review': {
            const body = parse('withdrawal-review');
            const withdrawal = state.withdrawals.find(w => w.id === body.id);
            if (!withdrawal || withdrawal.status !== 'Pending') throw new Error('Only pending withdrawals can be reviewed.');
            const member = memberFor(withdrawal.memberId);
            if (body.decision === 'Approved') {
                if (new Date(withdrawal.eligibleAt) > now) throw new Error('Notice period has not ended.');
                if (member.outstanding > 0 || state.loans.some(l => l.memberId === member.id && ['Pending', 'Under Review', 'Approved', 'Awaiting Disbursement'].includes(l.status) || l.memberId === member.id && loanBalance(l) > 0)) throw new Error('Resolve outstanding loans and applications first.');
                member.status = 'Withdrawn';
            }
            withdrawal.status = body.decision;
            audit(state, actor.id, `Withdrawal ${withdrawal.id}: ${body.decision}; ${body.note}`);
            break;
        }
        case 'announcement': {
            const body = parse('announcement');
            state.announcements.unshift({ id: randomUUID(), title: body.title, body: body.body, category: 'Cooperative update', createdAt: timestamp });
            audit(state, actor.id, `Announcement published: ${body.title}`);
            break;
        }
        case 'announcement-delete': {
            const body = parse('announcement-delete');
            const index = state.announcements.findIndex(a => a.id === body.id);
            if (index < 0) throw new Error('Announcement not found.');
            const [removed] = state.announcements.splice(index, 1);
            audit(state, actor.id, `Announcement removed: ${removed.title}`);
            break;
        }
        case 'dividend': {
            const body = parse('dividend');
            const member = memberFor(body.memberId);
            if (member.status !== 'Active') throw new Error('Active membership required.');
            const amount = amountInKobo(body.amount);
            if (state.dividends?.some(d => d.memberId === member.id && d.period.toLowerCase() === body.period.toLowerCase())) throw new Error('Dividend already allocated for this period.');
            (state.dividends ??= []).push({ id: randomUUID(), memberId: member.id, amount, period: body.period, createdAt: timestamp });
            audit(state, actor.id, `Dividend allocated: ${amount} kobo for ${member.number}, ${body.period}`);
            break;
        }
        case 'election': {
            const body = parse('election');
            const start = new Date(body.startsAt), end = new Date(body.endsAt);
            if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || start < now) throw new Error('Choose future election dates with the end after the start.');
            const names = body.candidates as string[];
            if (new Set(names.map(n => n.toLowerCase())).size !== names.length) throw new Error('Candidate names must be unique.');
            (state.elections ??= []).push({ id: randomUUID(), title: body.title, startsAt: start.toISOString(), endsAt: end.toISOString(), candidates: names.map(name => ({ id: randomUUID(), name })), votes: [], status: 'Scheduled' });
            audit(state, actor.id, `Election scheduled: ${body.title}`);
            break;
        }
        case 'election-publish':
        case 'election-cancel': {
            const body = parse('election-cancel');
            const election = state.elections?.find(e => e.id === body.id);
            if (!election || election.status !== 'Scheduled') throw new Error('Election cannot be changed.');
            if (action === 'election-publish' && now < new Date(election.endsAt)) throw new Error('Voting has not ended.');
            election.status = action === 'election-publish' ? 'Published' : 'Cancelled';
            audit(state, actor.id, `Election ${election.title}: ${election.status}`);
            break;
        }
    }
}
export function castVote(state: State, member: Member, electionId: string, candidateId: string, now = new Date()) {
    if (member.role !== 'member' || member.status !== 'Active') throw new Error('Active membership required.');
    const election = state.elections?.find(e => e.id === electionId);
    if (!election || election.status !== 'Scheduled' || now < new Date(election.startsAt) || now >= new Date(election.endsAt)) throw new Error('Voting is closed.');
    if (!election.candidates.some(c => c.id === candidateId)) throw new Error('Invalid candidate.');
    if (election.votes.some(v => v.memberId === member.id)) throw new Error('You have already voted.');
    election.votes.push({ memberId: member.id, candidateId });
    audit(state, member.id, `Vote cast in election ${election.id}`);
}
export function electionView(election: NonNullable<State['elections']>[number], memberId?: string) {
    const { votes, ...safe } = election;
    return { ...safe, hasVoted: votes.some(v => v.memberId === memberId), turnout: votes.length,
        results: election.status === 'Published' ? election.candidates.map(c => ({ ...c, votes: votes.filter(v => v.candidateId === c.id).length })) : [] };
}
