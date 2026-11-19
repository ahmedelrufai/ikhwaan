import { requirePortalMember } from '@/lib/portal-auth';
import Savings from '@/components/portal/savings';
export const metadata = { title: 'Savings & contributions · Ikhwaan' };
export default async function Page() {
    await requirePortalMember('/portal/savings');
    return <Savings/>;
}
