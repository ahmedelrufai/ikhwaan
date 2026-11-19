import { ADMIN_READ_FIELDS, adminReadSection, adminSnapshot } from '@/lib/admin-read';
import { after } from 'next/server';
import { loanEmailTasks, queueLoanEmails } from '@/lib/loan-notifications';
import { deliverLoanEmails } from '@/lib/loan-email-delivery';
import { administrativeAccess } from '@/lib/access';
import { NextResponse } from 'next/server';
import { currentMember, sameOrigin } from '@/lib/auth';
import { adminAction } from '@/lib/admin';
import { withState } from '@/lib/store';
import { csvResponse } from '@/lib/csv';
export async function GET(request: Request) {
    const started = performance.now();
    const actor = await currentMember();
    const authenticated = performance.now();
    if (!actor) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
    if (!administrativeAccess(actor)) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
    try {
        const query = new URL(request.url).searchParams;
        const section = adminReadSection(query.get('section'));
        const fields = query.get('export') === 'transactions' ? ['members', 'transactions'] as const : section === 'all' ? undefined : ADMIN_READ_FIELDS[section];
        const response = await withState(state => {
            const fresh = state.members.find(member => member.id === actor.id);
            if (!fresh || !administrativeAccess(fresh)) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
            if (query.get('export') === 'transactions') {
                const members = new Map(state.members.map(member => [member.id, member]));
                return csvResponse([['Date', 'Member', 'Number', 'Type', 'Description', 'Amount (NGN)', 'Reference'], ...state.transactions.map(transaction => {
                    const member = members.get(transaction.memberId);
                    return [transaction.date, member?.name, member?.number, transaction.type, transaction.description, (transaction.amount / 100).toFixed(2), transaction.reference];
                })], 'ikhwaan-transactions.csv');
            }
            return NextResponse.json(adminSnapshot(state, fresh, query), { headers: { 'Cache-Control': 'no-store' } });
        }, false, fields ? [...fields] : undefined);
        response.headers.set('Server-Timing', `auth;dur=${(authenticated - started).toFixed(1)}, data;dur=${(performance.now() - authenticated).toFixed(1)}`);
        return response;
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load records.' }, { status: 400 }); }
}
export async function POST(request: Request) {
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
    const actor = await currentMember();
    if (!actor) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
    if (!administrativeAccess(actor)) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
    try {
        const body = await request.json();
        if (!body || typeof body !== 'object') throw new Error('Invalid request.');
        await withState(state => {
            const fresh = state.members.find(m => m.id === actor.id);
            if (!fresh || !administrativeAccess(fresh)) throw new Error('Administrator access required.');
            const notify = typeof body.action === 'string' && (body.action.startsWith('loan-') || body.action === 'member-review');
            const before = notify ? loanEmailTasks(state) : [];
            adminAction(state, fresh, body);
            if (notify) queueLoanEmails(state, before);
        }, true);
        if (typeof body.action === 'string' && (body.action.startsWith('loan-') || body.action === 'member-review')) after(async () => { try { await deliverLoanEmails(); } catch { console.error('Loan email worker failed; pending messages remain queued.'); } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save.' }, { status: 400 });
    }
}
