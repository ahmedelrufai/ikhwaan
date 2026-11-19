import { memberEntryDestination } from './member-entry';
import { redirect } from 'next/navigation';
import { currentMember } from './auth';
import { accountDestination, memberDashboardAllowed } from './access';
export async function requirePortalMember(destination = '/portal') {
    const member = await currentMember();
    if (!member) redirect('/?next=' + encodeURIComponent(destination));
    if (member.role !== 'member' || !memberDashboardAllowed(member)) redirect(accountDestination(member));
    if (destination.split('?')[0] !== '/portal/payments') {
        const entry = await memberEntryDestination(member, destination);
        if (entry !== destination) redirect(entry);
    }
    return member;
}
