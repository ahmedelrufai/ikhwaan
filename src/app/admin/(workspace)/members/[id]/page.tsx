import { notFound } from 'next/navigation';
import { requireAdministrator } from '@/lib/admin-auth';
import { withState } from '@/lib/store';
import Details from '@/components/admin/member-details';
export const metadata = { title: 'Members details · Administration · Ikhwaan' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    await requireAdministrator('/admin/members/' + encodeURIComponent(id));
    const exists = await withState(state => state.members.some(member => member.id === id && member.role === 'member' && member.profileStatus !== 'Incomplete'), false, ['members']);
    if (!exists) notFound();
    return <Details/>;
}
