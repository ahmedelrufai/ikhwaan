import { redirect } from 'next/navigation';
import { requirePortalMember } from '@/lib/portal-auth';
import Overview from '@/components/portal/overview';
export const metadata = { title: 'Overview · Ikhwaan' };
export default async function MemberPage({ searchParams }: { searchParams: Promise<{ loan?: string; payment_reference?: string }> }) {
    const query = await searchParams;
    // Preserve previously emailed links and payment callbacks.
    if (query.loan && /^[A-Za-z0-9_-]+$/.test(query.loan)) redirect('/portal/loans/' + query.loan);
    if (query.payment_reference) redirect('/portal/payments?payment_reference=' + encodeURIComponent(query.payment_reference));
    await requirePortalMember('/portal');
    return <Overview/>;
}
