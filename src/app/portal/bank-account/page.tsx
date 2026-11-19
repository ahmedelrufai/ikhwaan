import { requirePortalMember } from '@/lib/portal-auth';
import BankAccount from '@/components/portal/bank-account';
export const metadata = { title: 'Bank account · Ikhwaan' };
export default async function Page() {
    await requirePortalMember('/portal/bank-account');
    return <BankAccount/>;
}
