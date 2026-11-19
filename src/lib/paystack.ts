/** Provider calls remain server-side; the optional transport is used by isolated tests. */
export async function paystackRequest(endpoint: string, key: string, body?: Record<string, unknown>, transport: typeof fetch = fetch) {
    const response = await transport('https://api.paystack.co' + endpoint, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000), cache: 'no-store' });
    const result = await response.json();
    if (!response.ok || result.status !== true || !result.data) throw new Error('Payment request failed. Please verify the payment status before retrying.');
    return result.data;
}
export function paystackCheckout(data: { authorization_url?: unknown; reference?: unknown }, reference: string) {
    if (data.reference !== reference || typeof data.authorization_url !== 'string') throw new Error('Unexpected payment checkout details.');
    const url = new URL(data.authorization_url);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.paystack.com' || url.username || url.password) throw new Error('Unexpected payment checkout address.');
    return url.toString();
}
