import { safeLoanDestination } from '@/lib/loan-links';
import { administrativeAccess } from '@/lib/access';
import { redirect } from 'next/navigation';
import { currentMember } from '@/lib/auth';
import EmailSignIn from '@/components/email-sign-in';
export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
    const { next } = await searchParams;
    const member = await currentMember();
    if (member && administrativeAccess(member)) redirect(safeLoanDestination(next, member) || '/admin');
    return <EmailSignIn adminLogin nextPath={next}/>;
}
