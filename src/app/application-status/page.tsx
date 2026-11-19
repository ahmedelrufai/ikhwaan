import { redirect } from 'next/navigation';
import { currentMember } from '@/lib/auth';
import { accountDestination } from '@/lib/access';
import ApplicationStatus from '@/components/application-status';
export default async function StatusPage() {
    const member = await currentMember();
    if (!member) redirect('/');
    const destination = accountDestination(member);
    if (destination !== '/application-status') redirect(destination);
    return <ApplicationStatus status={member.status}/>;
}
