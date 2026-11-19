import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountInKobo, noticeEnd } from '../src/lib/rules.ts';
test('currency uses integer kobo, preserving cents', () => { assert.equal(amountInKobo('12456578.84'), 1245657884); assert.equal(amountInKobo('0.01'), 1); for (const invalid of ['0', '-1', '1.001', 'NaN', '1e5', 123])
    assert.throws(() => amountInKobo(invalid)); });
test('three calendar months clamp end-of-month dates', () => { assert.equal(noticeEnd(new Date('2026-11-30T10:00:00Z')), '2027-02-28T10:00:00.000Z'); assert.equal(noticeEnd(new Date('2027-11-30T10:00:00Z')), '2028-02-29T10:00:00.000Z'); assert.equal(noticeEnd(new Date('2026-11-12T10:00:00Z')), '2027-02-12T10:00:00.000Z'); });
