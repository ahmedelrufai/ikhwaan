import { safeLoanDestination } from '@/lib/loan-links';
import { memberEntryDestination } from '@/lib/member-entry';
import { redirect } from 'next/navigation';
import { currentMember } from '@/lib/auth';
import EmailSignIn from '@/components/email-sign-in';
export default async function Home({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
 const { next } = await searchParams;
 const member = await currentMember();
 if (member) redirect(await memberEntryDestination(member, safeLoanDestination(next, member)));
 return <EmailSignIn nextPath={next}/>;
}
