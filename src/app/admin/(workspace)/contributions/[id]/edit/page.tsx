import { requireAdministrator } from '@/lib/admin-auth';
import { ContributionForm } from '@/components/admin/contributions';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; await requireAdministrator('/admin/contributions/' + encodeURIComponent(id) + '/edit'); return <ContributionForm key={id} id={id}/>; }
