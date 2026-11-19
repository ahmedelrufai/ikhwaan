import { requirePortalMember } from '@/lib/portal-auth';
import NewLoan from '@/components/portal/new-loan';
export const metadata = { title: 'Apply for a loan · Ikhwaan' };
export default async function Page({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
    const { draft } = await searchParams;
    const draftId = typeof draft === 'string' && /^[A-Za-z0-9_-]+$/.test(draft) ? draft : undefined;
    await requirePortalMember('/portal/loans/new' + (draftId ? '?draft=' + draftId : ''));
    return <NewLoan draftId={draftId}/>;
}
