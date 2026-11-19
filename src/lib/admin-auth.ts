import { redirect } from 'next/navigation';
import { currentMember } from './auth';
import { accountDestination, administrativeAccess } from './access';
export async function requireAdministrator(destination = '/admin') {
    const actor = await currentMember();
    if (!actor) redirect(destination === '/admin' ? '/admin/login' : '/admin/login?next=' + encodeURIComponent(destination));
    if (!administrativeAccess(actor)) redirect(actor.role === 'member' ? accountDestination(actor) : '/admin/login');
    return actor;
}
