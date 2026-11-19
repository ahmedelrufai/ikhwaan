import { requirePortalMember } from '@/lib/portal-auth';
import Dividends from '@/components/portal/dividends';
export const metadata = { title: 'Dividends · Ikhwaan' };
export default async function Page() {
    await requirePortalMember('/portal/dividends');
    return <Dividends/>;
}
