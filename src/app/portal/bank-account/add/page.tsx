import { requirePortalMember } from '@/lib/portal-auth';
import AddBankAccount from '@/components/portal/add-bank-account';
export const metadata = { title: 'Add bank account · Ikhwaan' };
export default async function Page({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
    const { returnTo } = await searchParams;
    await requirePortalMember('/portal/bank-account/add' + (returnTo === 'loan' ? '?returnTo=loan' : ''));
    return <AddBankAccount returnToLoan={returnTo === 'loan'}/>;
}
