import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistration } from '../src/lib/registration.ts';
const valid = { name: ' Amina Yusuf ', phone: '0801 234 5678', address: '12 Main Street', occupation: 'Teacher', officeAddress: '12 School Road', nationality: 'Nigerian', state: 'Lagos', lga: 'Ikeja', gender: 'Female', kinName: 'Ibrahim Yusuf', kinRelationship: 'Brother', kinAddress: '14 Main Street', kinPhone: '+234 801 234 5678', kinEmail: ' FAMILY@example.com ' };
test('registration trims fields and normalizes contacts', () => {
    const result = validateRegistration(valid);
    assert.equal(result.name, 'Amina Yusuf');
    assert.equal(result.phone, '08012345678');
    assert.equal(result.kinPhone, '+2348012345678');
    assert.equal(result.kinEmail, 'family@example.com');
});
test('registration rejects missing, malformed, and oversized fields', () => {
    for (const patch of [{ name: '   ' }, { address: 'a' }, { phone: 'abcdefghi' }, { kinPhone: '123' }, { phone: '1'.repeat(16) }, { kinEmail: 'invalid' }, { gender: 'invalid' }, { state: 123 }, { occupation: 'a'.repeat(501) }]) {
        assert.throws(() => validateRegistration({ ...valid, ...patch }));
    }
});

