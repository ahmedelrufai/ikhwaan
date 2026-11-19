export function noticeEnd(date: Date) {
    const result = new Date(date);
    const day = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + 3);
    const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(day, last));
    return result.toISOString();
}
export function amountInKobo(value: unknown) {
    if (typeof value !== 'string' || !/^\d{1,9}(\.\d{1,2})?$/.test(value))
        throw new Error('Enter an amount with up to 2 decimal places.');
    const [whole, fraction = ''] = value.split('.');
    const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (amount <= 0)
        throw new Error('Amount must be greater than zero.');
    return amount;
}
