import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBankDetails } from '../src/lib/bank-details.ts';
const valid = { bankName: ' Test Bank ', accountName: ' Amina Yusuf ', accountNumber: ' 0123456789 ' };
test('bank validation trims names and preserves leading account-number zeroes', () => {
    assert.deepEqual(validateBankDetails({ ...valid, role: 'admin' }), { bankName: 'Test Bank', accountName: 'Amina Yusuf', accountNumber: '0123456789' });
});
test('bank validation rejects missing or invalid account details', () => {
    for (const patch of [{ bankName: '' }, { accountName: ' ' }, { accountNumber: '' }, { accountNumber: '123456789' }, { accountNumber: '12345678901' }, { accountNumber: '01234a6789' }, { accountNumber: 1234567890 }]) assert.throws(() => validateBankDetails({ ...valid, ...patch }));
    assert.throws(() => validateBankDetails({}));
});
