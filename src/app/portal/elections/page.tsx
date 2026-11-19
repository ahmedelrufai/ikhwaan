import { requirePortalMember } from '@/lib/portal-auth';
import Elections from '@/components/portal/elections';
export const metadata = { title: 'Elections · Ikhwaan' };
export default async function Page() {
    await requirePortalMember('/portal/elections');
    return <Elections/>;
}
