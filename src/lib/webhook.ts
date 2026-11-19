import { createHmac, timingSafeEqual } from 'node:crypto';
function matches(expected: Buffer, supplied: string) {
    return /^[a-f0-9]{128}$/.test(supplied) && timingSafeEqual(expected, Buffer.from(supplied, 'hex'));
}
export function validWebhook(raw: Buffer, headers: Headers, secrets: { signing?: string; api?: string }, now = Math.floor(Date.now() / 1000)) {
    const header = headers.get('paystack-signature');
    if (secrets.signing) {
        if (!header) return false;
        const timestamps = header.split(',').map(p => p.trim()).filter(p => p.startsWith('t='));
        if (timestamps.length !== 1 || !/^t=\d+$/.test(timestamps[0])) return false;
        const timestamp = Number(timestamps[0].slice(2));
        if (Math.abs(now - timestamp) > 300) return false;
        const expected = createHmac('sha512', secrets.signing).update(`${timestamp}.`).update(raw).digest();
        return header.split(',').some(p => {
            const entry = p.trim();
            if (!entry.startsWith('v1=')) return false;
            const colon = entry.indexOf(':');
            return colon > 3 && matches(expected, entry.slice(colon + 1));
        });
    }
    if (!secrets.api || header) return false;
    return matches(createHmac('sha512', secrets.api).update(raw).digest(), headers.get('x-paystack-signature') || '');
}
