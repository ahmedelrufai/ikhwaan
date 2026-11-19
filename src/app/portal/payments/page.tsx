import { requirePortalMember } from '@/lib/portal-auth';
import Payments from '@/components/portal/payments';
export const metadata = { title: 'Payments · Ikhwaan' };
export default async function Page({ searchParams }: { searchParams: Promise<{ payment_reference?: string }> }) {
    const { payment_reference: reference } = await searchParams;
    await requirePortalMember('/portal/payments' + (reference ? '?payment_reference=' + encodeURIComponent(reference) : ''));
    return <Payments/>;
}
