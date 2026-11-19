import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import * as yup from 'yup';
import { audit, type Member, type State } from './store.ts';
import { emailConfiguration, sendEmail, type EmailTransport } from './email.ts';
export type EmailOtp = { id: string; memberId: string; digest: string; expiresAt: string; createdAt: string; attempts: number; windowStart: string; requests: number; delivered?: boolean };
const localSecret = randomBytes(32).toString('hex');
function secret() {
    const value = process.env.SESSION_SECRET;
    if (process.env.NODE_ENV === 'production' && (!value || value.length < 32)) throw new Error('Configure SESSION_SECRET.');
    return value || localSecret;
}
const emailSchema = yup.string().strict().trim().lowercase().required('Email address is required.').email('Enter a valid email address.').max(254);
export function normalizeEmail(value: unknown) {
    if (typeof value !== 'string') throw new Error('Enter a valid email address.');
    return emailSchema.validateSync(value.trim().toLowerCase());
}
function digest(id: string, code: string) { return createHmac('sha256', secret()).update(`${id}:${code}`).digest('hex'); }
export function requestEmailOtp(state: State, input: unknown, now = new Date()) {
    const email = normalizeEmail(input);
    let member = state.members.find(m => m.email.toLowerCase() === email);
    const previous = member && state.emailOtps?.find(otp => otp.memberId === member?.id);
    if (previous && now.getTime() - new Date(previous.createdAt).getTime() < 60000) throw new Error('Wait 60 seconds before requesting another code.');
    const sameWindow = previous && now.getTime() - new Date(previous.windowStart).getTime() < 60 * 60 * 1000;
    if (sameWindow && previous.requests >= 5) throw new Error('Too many codes requested. Try again in an hour.');
    if (!member) {
        member = { id: randomUUID(), number: '', email, password: '', role: 'member', status: 'Profile incomplete', profileStatus: 'Incomplete', name: '', phone: '', address: '', occupation: '', officeAddress: '', nationality: '', state: '', lga: '', gender: '', kinName: '', kinRelationship: '', kinAddress: '', kinPhone: '', kinEmail: '', outstanding: 0 };
        state.members.push(member);
    }
    const id = randomUUID(), code = String(randomInt(0, 1000000)).padStart(6, '0');
    const challenge: EmailOtp = { id, memberId: member.id, digest: digest(id, code), createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(), attempts: 0, windowStart: sameWindow ? previous.windowStart : now.toISOString(), requests: sameWindow ? previous.requests + 1 : 1 };
    state.emailOtps = [...(state.emailOtps || []).filter(otp => otp.memberId !== member.id), challenge];
    return { challengeId: id, email, code };
}
/** Return errors rather than throw so failed attempts are committed to storage. */
export function verifyEmailOtp(state: State, challengeId: unknown, code: unknown, now = new Date()): { member?: Member; error?: string } {
    const challenge = state.emailOtps?.find(otp => otp.id === challengeId);
    const invalid = { error: 'Invalid or expired code. Request a new code and try again.' };
    if (!challenge || !challenge.delivered || challenge.attempts >= 5 || new Date(challenge.expiresAt).getTime() <= now.getTime()) return invalid;
    challenge.attempts++;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return invalid;
    const expected = Buffer.from(challenge.digest, 'hex'), supplied = Buffer.from(digest(challenge.id, code), 'hex');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return invalid;
    const member = state.members.find(m => m.id === challenge.memberId);
    if (!member || (member.role === 'admin' && member.status !== 'Active') || !['member', 'admin'].includes(member.role)) return invalid;
    // Retain request counters for persistent rate limits, but make the code unusable.
    challenge.delivered = false; challenge.digest = ''; challenge.attempts = 5;
    member.emailVerifiedAt = now.toISOString();
    audit(state, member.id, 'Email sign-in verified');
    return { member };
}
export async function sendEmailOtp(email: string, code: string, challengeId: string, transport?: EmailTransport) {
    const config = emailConfiguration();
    if (!config && !transport) throw new Error('Email sign-in is not configured. Contact the cooperative.');
    await sendEmail({ from: config?.from || 'test@example.test', to: email, subject: 'Your Ikhwaan sign-in code', text: `Your Ikhwaan sign-in code is ${code}. It expires in 10 minutes and can only be used once. Do not share this code. If you did not request it, ignore this email.`, html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#20392c;background:#f4f7f2;padding:24px"><main style="max-width:480px;margin:auto;background:white;padding:32px;border-radius:12px"><p style="color:#216a50;font-weight:bold">IKHWAAN COOPERATIVE</p><h1 style="font-size:24px">Your sign-in code</h1><p>Enter this code to continue:</p><p style="font-size:36px;letter-spacing:8px;font-weight:bold">${code}</p><p>This code expires in 10 minutes and can only be used once.</p><p>Do not share it. If you did not request this email, you can ignore it.</p></main></body></html>`, messageId: `<signin-${challengeId}@ikhwaan.local>` }, transport);
}
