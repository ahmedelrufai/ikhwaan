import { requirePortalMember } from '@/lib/portal-auth';
import Membership from '@/components/portal/membership';
export const metadata = { title: 'My membership · Ikhwaan' };
export default async function Page() {
    await requirePortalMember('/portal/membership');
    return <Membership/>;
}
