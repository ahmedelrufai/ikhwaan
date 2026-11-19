import { requirePortalMember } from '@/lib/portal-auth';
import Loans from '@/components/portal/loans';
export const metadata = { title: 'Emergency loans · Ikhwaan' };
export default async function Page() {
    await requirePortalMember('/portal/loans');
    return <Loans/>;
}
