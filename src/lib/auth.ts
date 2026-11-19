import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { memberForSession } from './store';
const localSecret = randomBytes(32).toString('hex');
function secret() { if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32))
    throw new Error('Configure SESSION_SECRET.'); return process.env.SESSION_SECRET || localSecret; }
export async function setSession(id: string, version = 0) { const payload = Buffer.from(JSON.stringify({ id, version, expires: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url'); const signature = createHmac('sha256', secret()).update(payload).digest('hex'); (await cookies()).set('ikhwaan_session', `${payload}.${signature}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 }); }
export async function currentMember() { const token = (await cookies()).get('ikhwaan_session')?.value; if (!token)
    return null; try {
    const [payload, signature] = token.split('.');
    const expected = createHmac('sha256', secret()).update(payload).digest();
    const supplied = Buffer.from(signature, 'hex');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
        return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (parsed.expires < Date.now())
        return null;
    if (typeof parsed.id !== 'string' || !Number.isFinite(parsed.expires) || !Number.isInteger(parsed.version || 0)) return null;
    return memberForSession(parsed.id, parsed.version || 0);
}
catch {
    return null;
} }
export function sameOrigin(request: Request) { const origin = request.headers.get('origin'); if (!origin)
    return false; try {
    const parsed = new URL(origin);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.host === request.headers.get('host');
}
catch {
    return false;
} }
const attempts = new Map<string, {
    count: number;
    until: number;
}>();
export function rateLimit(key: string) { const now = Date.now(); const item = attempts.get(key); if (!item || item.until < now) {
    if (attempts.size > 10000)
        attempts.clear();
    attempts.set(key, { count: 1, until: now + 15 * 60 * 1000 });
    return true;
} return ++item.count <= 20; }
