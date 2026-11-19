import { requireAdministrator } from '@/lib/admin-auth';
import Contributions from '@/components/admin/contributions';
export default async function Page() { await requireAdministrator('/admin/contributions'); return <Contributions/>; }
