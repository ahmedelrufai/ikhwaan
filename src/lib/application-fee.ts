import { memberDashboardAllowed } from './access.ts';
import type { Member, Payment } from './store.ts';

export function applicationFeeRequired(member: Pick<Member, 'id' | 'role' | 'status' | 'profileStatus'>, payments: Payment[]) {
    return memberDashboardAllowed(member) && !payments.some(payment => payment.memberId === member.id && (!payment.purpose || payment.purpose === 'Membership fee') && payment.status === 'Successful');
}
