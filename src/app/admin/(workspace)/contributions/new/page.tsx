import { requireAdministrator } from '@/lib/admin-auth';
import { ContributionForm } from '@/components/admin/contributions';
export default async function Page() { await requireAdministrator('/admin/contributions/new'); return <ContributionForm/>; }
