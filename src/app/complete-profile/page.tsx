import { redirect } from 'next/navigation';
import { currentMember } from '@/lib/auth';
import { accountDestination } from '@/lib/access';
import { withState } from '@/lib/store';
import CompleteProfile from '@/components/complete-profile';
export default async function CompleteProfilePage() {
    const member = await currentMember();
    if (!member) redirect('/');
    if (accountDestination(member) !== '/complete-profile') redirect(accountDestination(member));
    const profile = await withState(state => state.memberProfiles?.find(p => p.memberId === member.id), false, ['memberProfiles']);
    return <CompleteProfile email={member.email} profile={profile}/>;
}
