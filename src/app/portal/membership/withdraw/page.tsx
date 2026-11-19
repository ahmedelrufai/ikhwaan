import { requirePortalMember } from '@/lib/portal-auth';
import Withdrawal from '@/components/portal/withdrawal';
export const metadata = { title: 'Membership withdrawal · Ikhwaan' };
export default async function Page() {
    await requirePortalMember('/portal/membership/withdraw');
    return <Withdrawal/>;
}
