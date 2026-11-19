import { requirePortalMember } from '@/lib/portal-auth';
import EditMembership from '@/components/portal/edit-membership';
export const metadata = { title: 'Edit profile · Ikhwaan' };
export default async function Page() {
    await requirePortalMember('/portal/membership/edit');
    return <EditMembership/>;
}
