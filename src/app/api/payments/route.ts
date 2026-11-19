import { paystackRequest as paystack, paystackCheckout } from '@/lib/paystack';
import { memberDashboardAllowed } from '@/lib/access';
import { paymentConfiguration, reconcilePayment, reserveLoanPayment, reserveBalancePayment, membershipPayment, paymentNeedsLedgerCredit } from '@/lib/payments';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { currentMember, rateLimit, sameOrigin } from '@/lib/auth';
import { audit, withState } from '@/lib/store';
async function settings(initializing: boolean) {
    const key = process.env.PAYSTACK_SECRET_KEY;
    const config = await withState(paymentConfiguration, false, ['paymentSettings']);
    if (!key || (initializing && (!config.enabled || !Number.isSafeInteger(config.amount) || config.amount <= 0))) throw new Error('Payments are not yet available.');
    return { key, amount: config.amount };
}
export async function POST(request: Request) { if (!sameOrigin(request))
    return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 }); const member = await currentMember(); if (!member)
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 }); if (member.role !== 'member') return NextResponse.json({ error: 'Member access required.' }, { status: 403 }); if (!memberDashboardAllowed(member)) return NextResponse.json({ error: 'Membership approval required.' }, { status: 403 }); if (!rateLimit('payment:' + member.id))
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 }); try {
    const body = await request.json();
    if (!body || typeof body !== 'object') throw new Error('Invalid payment request.');
    const config = await settings(body.action === 'initialize');
    if (body.action === 'initialize-contribution' || body.action === 'initialize-savings') {
        const purpose = body.action === 'initialize-contribution' ? 'Contribution' : 'Savings';
        const payment = await withState(state => {
            const fresh = state.members.find(m => m.id === member.id);
            if (!fresh) throw new Error('Account not found.');
            return reserveBalancePayment(state, fresh, purpose, body.amount, new Date(), body.contributionId, body.period);
        }, true);
        if (payment.checkoutUrl) return NextResponse.json({ url: payment.checkoutUrl });
        try {
            const result = await paystack('/transaction/initialize', config.key, { email: payment.customerEmail, amount: payment.amount, currency: payment.currency, reference: payment.reference, metadata: { purpose, contributionId: payment.contributionId, period: payment.contributionPeriod }, callback_url: request.headers.get('origin') + '/portal/payments?payment_reference=' + encodeURIComponent(payment.reference) });
            const url = paystackCheckout(result, payment.reference);
            await withState(state => { const stored = state.payments?.find(p => p.reference === payment.reference); if (!stored) throw new Error('Payment not found.'); stored.checkoutUrl = url; }, true);
            return NextResponse.json({ url });
        } catch {
            return NextResponse.json({ error: 'Checkout could not be opened. Verify this pending payment before retrying or contact the cooperative.', reference: payment.reference }, { status: 502 });
        }
    }
    if (body.action === 'initialize-loan') {
        const payment = await withState(state => {
            const fresh = state.members.find(m => m.id === member.id);
            if (!fresh) throw new Error('Account not found.');
            return reserveLoanPayment(state, fresh, body.loanId, body.amount);
        }, true);
        if (payment.checkoutUrl) return NextResponse.json({ url: payment.checkoutUrl });
        try {
            const result = await paystack('/transaction/initialize', config.key, { email: payment.customerEmail, amount: payment.amount, currency: payment.currency, reference: payment.reference, metadata: { purpose: 'Loan repayment', loanId: payment.loanId }, callback_url: request.headers.get('origin') + '/portal/loans/' + encodeURIComponent(payment.loanId!) + '/pay?payment_reference=' + encodeURIComponent(payment.reference) });
            const url = paystackCheckout(result, payment.reference);
            await withState(state => { const stored = state.payments?.find(p => p.reference === payment.reference); if (!stored) throw new Error('Payment not found.'); stored.checkoutUrl = url; }, true);
            return NextResponse.json({ url });
        } catch {
            return NextResponse.json({ error: 'Unable to open checkout. This payment remains pending; verify its status before retrying or contact the cooperative.', reference: payment.reference }, { status: 502 });
        }
    }
    if (body.action === 'initialize') {
        const payment = await withState(state => {
            const current = state.members.find(m => m.id === member.id);
            if (!current || !memberDashboardAllowed(current)) throw new Error('Membership approval required.');
            state.payments ??= [];
            if (state.payments.some(p => p.memberId === member.id && membershipPayment(p) && p.status === 'Successful')) throw new Error('Membership fee already paid.');
            const pending = state.payments.find(p => p.memberId === member.id && membershipPayment(p) && p.status === 'Pending');
            if (pending?.checkoutUrl) return pending;
            if (pending && Date.now() - new Date(pending.createdAt).getTime() < 60000) throw new Error('Payment is initializing. Try again shortly.');
            if (pending) pending.status = 'Failed';
            const created = { id: randomUUID(), memberId: member.id, reference: 'ikh_' + randomUUID(), amount: config.amount, currency: 'NGN', purpose: 'Membership fee' as const, customerEmail: member.email, status: 'Pending', createdAt: new Date().toISOString() };
            state.payments.push(created); audit(state, member.id, 'Membership payment initiated');
            return created;
        }, true);
        if ('checkoutUrl' in payment && payment.checkoutUrl) return NextResponse.json({ url: payment.checkoutUrl });
        try {
            const result = await paystack('/transaction/initialize', config.key, { email: member.email, amount: payment.amount, currency: 'NGN', reference: payment.reference, callback_url: request.headers.get('origin') + '/portal/payments?payment_reference=' + encodeURIComponent(payment.reference) });
            const url = paystackCheckout(result, payment.reference);
            await withState(state => { const stored = state.payments!.find(p => p.reference === payment.reference)!; stored.checkoutUrl = url; }, true);
            return NextResponse.json({ url });
        } catch (error) {
            await withState(state => { const stored = state.payments!.find(p => p.reference === payment.reference)!; if (stored.status === 'Pending') stored.status = 'Failed'; }, true);
            throw error;
        }
    }
    if (body.action === 'verify') {
        const reference = String(body.reference || '');
        if (!/^ikh_[a-f0-9-]{36}$/.test(reference))
            throw new Error('Invalid payment reference.');
        const payment = await withState(state => state.payments?.find(p => p.reference === reference && p.memberId === member.id));
        if (!payment)
            throw new Error('Payment was not found.');
        if (payment.status === 'Successful' && !paymentNeedsLedgerCredit(payment)) return NextResponse.json({ status: payment.status, reconciliationStatus: payment.reconciliationStatus, message: payment.reconciliationNote, loanId: payment.loanId, redirectTo: payment.reconciliationStatus === 'Needs review' ? undefined : membershipPayment(payment) ? '/portal' : payment.purpose === 'Savings' || payment.purpose === 'Contribution' ? '/portal/savings' : undefined });
        const verified = await paystack('/transaction/verify/' + encodeURIComponent(reference), config.key);
        if (verified.reference !== reference || verified.amount !== payment.amount || verified.currency !== payment.currency || verified.customer?.email?.toLowerCase() !== (payment.customerEmail || member.email).toLowerCase())
            throw new Error('Payment details do not match.');
        const settled = await withState(state => reconcilePayment(state, verified), true);
        return NextResponse.json({ status: settled.status, reconciliationStatus: settled.reconciliationStatus, message: settled.reconciliationNote, loanId: settled.loanId, redirectTo: settled.status === 'Successful' && settled.reconciliationStatus !== 'Needs review' ? membershipPayment(settled) ? '/portal' : settled.purpose === 'Savings' || settled.purpose === 'Contribution' ? '/portal/savings' : undefined : undefined });
    }
    throw new Error('Unknown payment action.');
}
catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payment request failed.' }, { status: 400 });
} }
