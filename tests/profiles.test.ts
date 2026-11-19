import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, type Member } from '../src/lib/store.ts';
import { requestEmailOtp, verifyEmailOtp } from '../src/lib/email-otp.ts';
import { saveProfileStage } from '../src/lib/profiles.ts';
import { adminAction } from '../src/lib/admin.ts';
import { accountDestination, memberDashboardAllowed } from '../src/lib/access.ts';
const now = new Date('2026-11-18T12:00:00Z');
const personal = { stage: 'personal', name: 'New Member', phone: '08012345678', address: '12 Test Road', occupation: 'Teacher', officeAddress: '14 School Road', nationality: 'Nigerian', state: 'Lagos', lga: 'Ikeja', gender: 'Female' };
const kin = { stage: 'next-of-kin', kinName: 'Family Member', kinRelationship: 'Brother', kinAddress: '16 Family Road', kinPhone: '08012345679', kinEmail: 'FAMILY@example.test' };
function fixture() {
    const state = emptyState(), otp = requestEmailOtp(state, 'new@example.test', now);
    state.emailOtps![0].delivered = true;
    const member = verifyEmailOtp(state, otp.challengeId, otp.code, now).member!;
    return { state, member };
}
test('personal profile is saved separately and can be resumed before submission', () => {
    const { state, member } = fixture();
    saveProfileStage(state, member, personal, now);
    assert.equal(member.name, ''); assert.equal(member.profileStatus, 'Incomplete');
    assert.equal(state.memberProfiles![0].personal?.name, 'New Member');
    const resumed = JSON.parse(JSON.stringify(state));
    saveProfileStage(resumed, resumed.members[0], { ...personal, name: 'Updated Member' }, now);
    assert.equal(resumed.memberProfiles[0].personal.name, 'Updated Member');
    assert.equal(accountDestination(member), '/complete-profile');
});
test('only complete, verified profiles are submitted and approval remains an admin decision', () => {
    const { state, member } = fixture();
    assert.throws(() => saveProfileStage(state, member, kin, now), /personal profile first/);
    assert.throws(() => saveProfileStage(state, { ...member, emailVerifiedAt: undefined }, personal, now), /verified/);
    saveProfileStage(state, member, { ...personal, role: 'admin', status: 'Active', email: 'other@example.test' }, now);
    assert.throws(() => saveProfileStage(state, member, { ...kin, kinEmail: 'bad' }, now));
    assert.equal(member.profileStatus, 'Incomplete');
    saveProfileStage(state, member, { ...kin, role: 'admin', status: 'Active' }, now);
    assert.equal(member.role, 'member'); assert.equal(member.email, 'new@example.test');
    assert.equal(member.status, 'Pending review'); assert.equal(member.profileStatus, 'Submitted');
    assert.equal(member.kinEmail, 'family@example.test'); assert.match(member.number, /^\d{11}$/);
    assert.equal(memberDashboardAllowed(member), false); assert.equal(accountDestination(member), '/application-status');
    const admin = { ...member, id: 'admin', role: 'admin', status: 'Active' } as Member;
    state.members.push(admin);
    adminAction(state, admin, { action: 'member-review', id: member.id, status: 'Active' }, now);
    assert.equal(accountDestination(member), '/portal');
    assert.throws(() => saveProfileStage(state, member, personal, now), /incomplete/);
});
test('administrators cannot approve incomplete profiles; duplicate phones and wrong input types are rejected', () => {
    const { state, member } = fixture();
    const admin = { ...member, id: 'admin', role: 'admin', status: 'Active', profileStatus: undefined } as Member;
    state.members.push(admin);
    assert.throws(() => adminAction(state, admin, { action: 'member-review', id: member.id, status: 'Active' }, now), /complete profile/);
    assert.throws(() => saveProfileStage(state, member, { ...personal, state: 123 }, now), /text/);
    state.members.push({ ...member, id: 'other', phone: personal.phone });
    assert.throws(() => saveProfileStage(state, member, personal, now), /already used/);
});
