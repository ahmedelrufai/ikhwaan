import { NextResponse } from 'next/server';
import { validWebhook } from '@/lib/webhook';
import { reconcilePayment } from '@/lib/payments';
import { withState } from '@/lib/store';
export async function POST(request: Request) {
    const raw = Buffer.from(await request.arrayBuffer());
    if (raw.length > 1024 * 1024) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
    if (!validWebhook(raw, request.headers, { signing: process.env.PAYSTACK_WEBHOOK_SECRET, api: process.env.PAYSTACK_SECRET_KEY }))
        return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
    try {
        const event = JSON.parse(raw.toString('utf8'));
        if (event.event === 'charge.success') {
            await withState(state => {
                if (!state.payments?.some(p => p.reference === event.data?.reference)) return;
                if (event.data.status !== 'success') throw new Error('Unexpected charge status.');
                reconcilePayment(state, event.data);
            }, true);
        }
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Unable to reconcile payment.' }, { status: 500 });
    }
}
