import { randomInt } from 'node:crypto';
import * as yup from 'yup';
import { registrationSchema, normalizePhone } from './registration.ts';
import { audit, type Member, type State } from './store.ts';
export const personalProfileSchema = registrationSchema.pick(['name', 'phone', 'address', 'occupation', 'officeAddress', 'nationality', 'state', 'lga', 'gender']);
export const nextOfKinSchema = registrationSchema.pick(['kinName', 'kinRelationship', 'kinAddress', 'kinPhone', 'kinEmail']);
export type PersonalProfile = yup.InferType<typeof personalProfileSchema>;
export type NextOfKinProfile = yup.InferType<typeof nextOfKinSchema>;
export type MemberProfile = { memberId: string; personal?: PersonalProfile; nextOfKin?: NextOfKinProfile; updatedAt: string; submittedAt?: string };
function validateStage<T extends yup.AnyObjectSchema>(schema: T, input: Record<string, unknown>): yup.InferType<T> {
    for (const key of Object.keys(schema.fields)) if (key in input && typeof input[key] !== 'string') throw new Error(`${key} must be text.`);
    return schema.validateSync(input, { stripUnknown: true });
}
export function saveProfileStage(state: State, member: Member, input: Record<string, unknown>, now = new Date()) {
    if (member.role !== 'member' || member.profileStatus !== 'Incomplete' || !member.emailVerifiedAt) throw new Error('A verified account with an incomplete profile is required.');
    if (!['personal', 'next-of-kin'].includes(String(input.stage))) throw new Error('Choose a profile stage.');
    let profile = state.memberProfiles?.find(p => p.memberId === member.id);
    if (input.stage === 'personal') {
        const personal = validateStage(personalProfileSchema, input);
        if (state.members.some(m => m.id !== member.id && m.phone && normalizePhone(m.phone) === personal.phone) || state.memberProfiles?.some(p => p.memberId !== member.id && p.personal?.phone === personal.phone)) throw new Error('This mobile number is already used by another member.');
        if (!profile) { profile = { memberId: member.id, updatedAt: now.toISOString() }; (state.memberProfiles ??= []).push(profile); }
        profile.personal = personal; profile.updatedAt = now.toISOString();
        return profile;
    }
    if (!profile?.personal) throw new Error('Complete your personal profile first.');
    const nextOfKin = validateStage(nextOfKinSchema, input);
    // Revalidate both stages together before making the profile visible for approval.
    const fields = registrationSchema.validateSync({ ...profile.personal, ...nextOfKin }, { stripUnknown: true });
    if (state.members.some(m => m.id !== member.id && m.phone && normalizePhone(m.phone) === fields.phone)) throw new Error('This mobile number is already used by another member.');
    let number = member.number;
    if (!number) do { number = String(randomInt(10000000000, 99999999999)); } while (state.members.some(m => m.number === number));
    profile.nextOfKin = nextOfKin; profile.updatedAt = now.toISOString(); profile.submittedAt = now.toISOString();
    Object.assign(member, fields, { number, profileStatus: 'Submitted', status: 'Pending review' });
    audit(state, member.id, 'Membership application submitted', { type: 'member', id: member.id });
    return profile;
}
