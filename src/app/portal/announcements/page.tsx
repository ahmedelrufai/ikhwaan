import { requirePortalMember } from '@/lib/portal-auth';
import Announcements from '@/components/portal/announcements';
export const metadata = { title: 'Announcements · Ikhwaan' };
export default async function Page() {
    await requirePortalMember('/portal/announcements');
    return <Announcements/>;
}
