import { applicationFeeRequired } from './application-fee';
import { accountDestination } from './access';
import { withState, type Member } from './store';

export async function memberEntryDestination(member: Member, requested?: string) {
    const destination = accountDestination(member);
    if (destination !== '/portal') return requested || destination;
    const unpaid = await withState(state => applicationFeeRequired(member, state.payments || []), false, ['payments']);
    // Preserve the Paystack reference when a signed-out member returns through sign-in.
    return unpaid ? requested?.split('?')[0] === '/portal/payments' ? requested : '/portal/payments' : requested || destination;
}
