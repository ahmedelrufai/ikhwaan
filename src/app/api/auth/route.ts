import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { safeLoanDestination } from '@/lib/loan-links';
import { memberEntryDestination } from '@/lib/member-entry';
import { administrativeAccess, accountDestination } from '@/lib/access';
import { currentMember, rateLimit, sameOrigin, setSession } from '@/lib/auth';
import { emailConfiguration } from '@/lib/email';
import { normalizeEmail, requestEmailOtp, verifyEmailOtp, sendEmailOtp } from '@/lib/email-otp';
import { publicMember, withState } from '@/lib/store';
export const maxDuration = 60;
export async function GET() {
    const member = await currentMember();
    return NextResponse.json({ member: member ? publicMember(member) : null }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
    if (!rateLimit('auth:' + (request.headers.get('x-forwarded-for') || 'local'))) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    try {
        const body = await request.json();
        if (!body || typeof body !== 'object') throw new Error('Invalid authentication request.');
        if (body.action === 'logout') {
            const actor = await currentMember();
            if (actor) await withState(state => { const member = state.members.find(m => m.id === actor.id); if (member) member.sessionVersion = (member.sessionVersion || 0) + 1; }, true);
            (await cookies()).delete('ikhwaan_session');
            return NextResponse.json({ ok: true });
        }
        if (body.action === 'request-otp') {
            const email = normalizeEmail(body.email);
            if (!emailConfiguration()) return NextResponse.json({ error: 'Email sign-in is not configured. Contact the cooperative.' }, { status: 503 });
            const challenge = await withState(state => requestEmailOtp(state, email), true);
            try {
                await sendEmailOtp(challenge.email, challenge.code, challenge.challengeId);
                await withState(state => { const otp = state.emailOtps?.find(o => o.id === challenge.challengeId); if (otp) otp.delivered = true; }, true);
            } catch {
                await withState(state => { const otp = state.emailOtps?.find(o => o.id === challenge.challengeId); if (otp) { otp.delivered = false; otp.digest = ''; } }, true);
                return NextResponse.json({ error: 'We could not send your code. Try again in a minute.' }, { status: 503 });
            }
            return NextResponse.json({ ok: true, challengeId: challenge.challengeId, email, expiresIn: 600, resendAfter: 60 });
        }
        if (body.action === 'verify-otp') {
            const result = await withState(state => verifyEmailOtp(state, body.challengeId, body.code), true);
            if (!result.member) return NextResponse.json({ error: 'Invalid or expired code. Request a new code if needed.' }, { status: 400 });
            const member = result.member;
            await setSession(member.id, member.sessionVersion || 0);
            const destination = body.portal === 'admin' && administrativeAccess(member) ? '/admin' : accountDestination(member);
            return NextResponse.json({ member: publicMember(member), redirectTo: destination === '/admin' ? safeLoanDestination(body.next, member) || destination : await memberEntryDestination(member, safeLoanDestination(body.next, member)) });
        }
        throw new Error('Use email verification to sign in.');
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to sign in.' }, { status: 400 });
    }
}
