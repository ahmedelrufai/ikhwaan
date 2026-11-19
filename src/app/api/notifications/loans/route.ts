import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { deliverLoanEmails } from '@/lib/loan-email-delivery';
export const maxDuration = 60;

// Schedule a POST every minute. No session cookie or public GET can send mail.
export async function POST(request: Request) {
    const secret = process.env.LOAN_EMAIL_CRON_SECRET;
    const supplied = request.headers.get('authorization');
    const expected = secret ? `Bearer ${secret}` : '';
    if (!secret || !supplied || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    try {
        const result = await deliverLoanEmails();
        return NextResponse.json(result, { status: result.configured ? 200 : 503 });
    } catch {
        return NextResponse.json({ error: 'Notification worker failed. Pending emails remain queued.' }, { status: 503 });
    }
}
