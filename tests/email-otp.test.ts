import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, type Member } from '../src/lib/store.ts';
import { requestEmailOtp, verifyEmailOtp, normalizeEmail, sendEmailOtp } from '../src/lib/email-otp.ts';
import { accountDestination, memberDashboardAllowed } from '../src/lib/access.ts';
const now = new Date('2026-11-18T12:00:00Z');
function issued() {
    const state = emptyState(); const challenge = requestEmailOtp(state, ' NEW@example.test ', now);
    state.emailOtps![0].delivered = true;
    return { state, challenge };
}
test('email-only account creation separates account identity from profile and never stores a plaintext code', () => {
    const { state, challenge } = issued();
    assert.equal(state.members.length, 1); assert.equal(state.members[0].email, 'new@example.test');
    assert.equal(state.members[0].profileStatus, 'Incomplete'); assert.equal(state.members[0].role, 'member');
    assert.equal(state.members[0].number, ''); assert.equal(state.memberProfiles, undefined);
    assert.match(challenge.code, /^\d{6}$/); assert.equal(state.emailOtps![0].digest.length, 64);
    assert.notEqual(state.emailOtps![0].digest, challenge.code);
    assert.equal(accountDestination(state.members[0]), '/complete-profile');
    assert.equal(memberDashboardAllowed({ ...state.members[0], status: 'Active' }), false);
    for (const email of [undefined, 123, 'bad', 'x'.repeat(255) + '@example.test']) assert.throws(() => normalizeEmail(email));
});
test('existing accounts retain their identity, office, profile and approval state', () => {
    const state = emptyState();
    const existing = { id: 'existing', email: 'member@example.test', role: 'member', status: 'Active', name: 'Existing Member', office: 'Treasurer', outstanding: 100 } as Member;
    state.members.push(existing);
    const challenge = requestEmailOtp(state, ' MEMBER@example.test ', now); state.emailOtps![0].delivered = true;
    const result = verifyEmailOtp(state, challenge.challengeId, challenge.code, now);
    assert.equal(state.members.length, 1); assert.equal(result.member?.id, 'existing');
    assert.equal(result.member?.office, 'Treasurer'); assert.equal(result.member?.outstanding, 100);
    assert.equal(accountDestination(result.member!), '/portal');
});
test('codes require delivery confirmation, expire in ten minutes, and can only be verified once', () => {
    const { state, challenge } = issued();
    state.emailOtps![0].delivered = false;
    assert.equal(verifyEmailOtp(state, challenge.challengeId, challenge.code, now).member, undefined);
    state.emailOtps![0].delivered = true;
    const success = verifyEmailOtp(state, challenge.challengeId, challenge.code, now);
    assert.equal(success.member?.emailVerifiedAt, now.toISOString());
    assert.equal(verifyEmailOtp(state, challenge.challengeId, challenge.code, now).member, undefined);
    const expired = issued();
    assert.equal(verifyEmailOtp(expired.state, expired.challenge.challengeId, expired.challenge.code, new Date(now.getTime() + 600000)).member, undefined);
});
test('five failed guesses lock a code and failed attempts remain in state', () => {
    const { state, challenge } = issued();
    const wrong = challenge.code === '000000' ? '999999' : '000000';
    for (let index = 1; index <= 5; index++) {
        assert.equal(verifyEmailOtp(state, challenge.challengeId, wrong, now).member, undefined);
        assert.equal(state.emailOtps![0].attempts, index);
    }
    assert.equal(verifyEmailOtp(state, challenge.challengeId, challenge.code, now).member, undefined);
    assert.equal(verifyEmailOtp(state, 'unknown', challenge.code, now).member, undefined);
});
test('resending invalidates previous codes and enforces persistent cooldown and hourly limit', () => {
    const { state, challenge } = issued();
    assert.throws(() => requestEmailOtp(state, 'new@example.test', now), /60 seconds/);
    const newer = requestEmailOtp(state, 'new@example.test', new Date(now.getTime() + 60000));
    state.emailOtps![0].delivered = true;
    assert.equal(verifyEmailOtp(state, challenge.challengeId, challenge.code, new Date(now.getTime() + 60000)).member, undefined);
    assert.ok(verifyEmailOtp(state, newer.challengeId, newer.code, new Date(now.getTime() + 60000)).member);
    for (let index = 2; index < 5; index++) requestEmailOtp(state, 'new@example.test', new Date(now.getTime() + 60000 * index));
    assert.throws(() => requestEmailOtp(state, 'new@example.test', new Date(now.getTime() + 300000)), /Too many/);
    assert.doesNotThrow(() => requestEmailOtp(state, 'new@example.test', new Date(now.getTime() + 3600000)));
});
test('verification cannot activate or promote a pending account', () => {
    const { state, challenge } = issued();
    const member = verifyEmailOtp(state, challenge.challengeId, challenge.code, now).member!;
    assert.equal(member.status, 'Profile incomplete'); assert.equal(member.role, 'member');
    member.profileStatus = 'Submitted'; member.status = 'Pending review';
    assert.equal(accountDestination(member), '/application-status'); assert.equal(memberDashboardAllowed(member), false);
    member.status = 'Active'; assert.equal(accountDestination(member), '/portal');
});
test('OTP mail uses the configured transport and contains a six-digit code without exposing it in app responses', async () => {
    let text = '';
    await sendEmailOtp('person@example.test', '012345', 'test-id', { sendMail: async message => { assert.equal(message.to, 'person@example.test'); text = message.text; return { accepted: [message.to], rejected: [] }; } });
    assert.ok(text.includes('012345')); assert.ok(text.includes('10 minutes'));
});

test('OTP mail contains the generated code and delivery errors propagate without disclosing it through APIs', async () => {
    let body = '';
    await sendEmailOtp('member@example.test', '012345', 'test-challenge', { sendMail: async message => { body = message.text; assert.equal(message.to, 'member@example.test'); return { accepted: [message.to], rejected: [] }; } });
    assert.ok(body.includes('012345')); assert.ok(body.includes('10 minutes'));
    await assert.rejects(() => sendEmailOtp('member@example.test', '012345', 'test-challenge', { sendMail: async () => { throw new Error('SMTP unavailable'); } }), /SMTP unavailable/);
});
