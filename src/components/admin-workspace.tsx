'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronRight, ShieldCheck, X } from 'lucide-react';
import WorkspaceFrame from '@/components/workspace-frame';
import WorkspaceSkeleton from '@/components/workspace-skeleton';
import { usePathname } from 'next/navigation';
import { ActionButton } from '@/components/action-feedback';
import Pagination from '@/components/pagination';
import { paginate } from '@/lib/pagination';
import { activityLoanId } from '@/lib/activity-loan';
import { activityMemberId } from '@/lib/activity-member';
import { adminHref, adminPage, adminPageTitle, adminReadForPath } from '@/lib/admin-routes';
import { useRouter } from 'nextjs-toploader/app';
import { useTopLoader } from 'nextjs-toploader';
import { AdminContext, money, date, type AdminData as Data } from '@/components/admin/admin-context';
import type { State } from '@/lib/store';
export default function AdminWorkspace({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const view = adminPage(pathname).name;
    const title = adminPageTitle(pathname);
    const section = adminReadForPath(pathname);
    const memberId = /^\/admin\/members\/([^/]+)$/.exec(pathname)?.[1];
    const loanId = pathname === '/admin/loans/settings' ? undefined : /^\/admin\/loans\/([^/]+)$/.exec(pathname)?.[1];
    const loader = useTopLoader();
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('All');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [data, setData] = useState<Data>();
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search), 250); return () => clearTimeout(timer); }, [search]);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { setPage(1); }, [view, search, statusFilter, pageSize]);
    const [selectedActivity, setSelectedActivity] = useState<State['audit'][number] | null>(null);
    const activityDialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        setPage(1); setStatusFilter('All'); setError(''); setSelectedActivity(null);
        setSearch(new URLSearchParams(window.location.search).get('search') || '');
    }, [pathname]);
    useEffect(() => {
        if (selectedActivity) activityDialog.current?.showModal();
        else activityDialog.current?.close();
    }, [selectedActivity]);
    const query = new URLSearchParams({ section, search: debouncedSearch, status: statusFilter, page: String(page), pageSize: String(pageSize), ...(memberId || loanId ? { id: memberId || loanId! } : {}) }).toString();
    const activeQuery = useRef(query); activeQuery.current = query;
    const requests = useRef(new Map<string, { controller: AbortController; promise: Promise<void> }>());
    const load = useCallback((force = false): Promise<void> => {
        const existing = requests.current.get(query);
        if (existing && !force) return existing.promise;
        existing?.controller.abort();
        const controller = new AbortController();
        const promise = (async () => {
            try {
                const response = await fetch('/api/admin?' + query, { cache: 'no-store', signal: controller.signal });
                if (controller.signal.aborted || activeQuery.current !== query) return;
                if (response.status === 401) { window.location.assign('/admin/login?next=' + encodeURIComponent(window.location.pathname + window.location.search)); return; }
                if (response.status === 403) { window.location.assign('/portal'); return; }
                if (!response.ok) throw new Error('Unable to load admin records.');
                const result = await response.json();
                if (!controller.signal.aborted && activeQuery.current === query) setData(result);
            } catch (error) { if (!controller.signal.aborted) throw error; }
            finally { if (requests.current.get(query)?.controller === controller) requests.current.delete(query); }
        })();
        requests.current.set(query, { controller, promise });
        return promise;
    }, [query]);
    useEffect(() => {
        const refresh = () => { if (document.visibilityState !== 'hidden') void load().catch(e => setError(e.message)); };
        refresh();
        window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
        const timer = setInterval(refresh, 30000);
        return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); clearInterval(timer); requests.current.get(query)?.controller.abort(); };
    }, [load, query]);
    useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); } }, [notice]);
    async function refreshRecords() {
        setRefreshing(true); loader.start();
        try { await load(true); setError(''); }
        catch (e) { throw new Error(e instanceof Error ? e.message : 'Unable to refresh.'); }
        finally { setRefreshing(false); loader.done(); }
    }
    async function mutate(payload: Record<string, unknown>, form?: HTMLFormElement) {
        if (busy) throw new Error('Wait for the current action to finish.');
        setBusy(true); setError(''); setNotice('');
        try {
            const response = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            form?.reset();
            setNotice('Saved.');
            try { await load(true); } catch { throw new Error('Saved, but records could not refresh. Use Refresh.'); }
        } catch (e) { throw new Error(e instanceof Error ? e.message : 'Unable to save.'); }
        finally { setBusy(false); }
    }
    function submit(action: string) {
        return async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = event.currentTarget;
            const fields: Record<string, unknown> = Object.fromEntries(new FormData(form));
            if (action === 'payment-settings') fields.enabled = fields.enabled === 'on';
            if (action === 'election') {
                fields.candidates = String(fields.candidates).split('\n').map(n => n.trim()).filter(Boolean);
                fields.startsAt = new Date(String(fields.startsAt)).toISOString();
                fields.endsAt = new Date(String(fields.endsAt)).toISOString();
            }
            await mutate({ ...fields, action }, form);
        };
    }
    function changeView(name: string) { router.push(adminHref(name)); }
    if (!data || data.section !== section || (memberId || loanId) && (data as Data & { recordId?: string }).recordId !== (memberId || loanId)) return <WorkspaceFrame kind="admin" title={title} accountName={data?.actor.name} refreshing={refreshing} onRefresh={refreshRecords} showHeading={!loanId}>{error ? <section className="panel workspace-load-error"><p role="alert">{error}</p><button className="button secondary" onClick={() => void refreshRecords().then(() => router.refresh()).catch(e => setError(e.message))}>Try again</button></section> : <WorkspaceSkeleton variant={section === 'loans' ? 'loans' : section === 'overview' ? 'overview' : section.includes('new-') || section.includes('settings') || section.includes('details') ? 'form' : 'register'}/>}</WorkspaceFrame>;
    const selectedLoan = data.loans.find(l => l.id === loanId);
    const selectedMember = data.members.find(m => m.id === memberId);
    const visibleMembers = data.section === 'members' ? data.members : data.members.filter(m => `${m.name} ${m.email} ${m.number} ${m.phone}`.toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'All' || m.status === statusFilter));
    const memberName = (id: string) => data.members.find(m => m.id === id)?.name || 'Unknown member';
    const selectMember = <label>Member<select name="memberId" required defaultValue=""><option value="" disabled>Select member</option>{data.members.filter(m => m.status === 'Active').map(m => <option key={m.id} value={m.id}>{m.name} · {m.number}</option>)}</select></label>;
    const saveButton = <button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>;
    const matches = (text: string) => text.toLowerCase().includes(search.toLowerCase());
    const pendingLoans = data.loans.filter(l => ['Pending', 'Under Review'].includes(l.status) && !l.queueClosed);
    const pendingMembers = data.members.filter(m => m.status === 'Pending review');
    const actorName = (id: string) => data.members.find(m => m.id === id)?.name || data.officials.find(m => m.id === id)?.name || (id === data.actor.id ? data.actor.name : id === 'system' ? 'System' : 'Former account');
    const activities = [...data.audit].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const filteredActivities = data.section === 'audit' ? activities : activities.filter(a => matches(`${a.action} ${a.actor} ${actorName(a.actor)}`));
    const memberPage = data.section === 'members' && data.pageMeta ? { items: visibleMembers, ...data.pageMeta } : paginate(visibleMembers, page, pageSize);
    const loans = data.section === 'loans' ? data.loans : [...data.loans].filter(l => matches(`${memberName(l.memberId)} ${data.members.find(m => m.id === l.memberId)?.number || ''} ${l.id} ${l.reference || ''} ${l.status} ${l.reason}`) && (statusFilter === 'All' || (statusFilter === 'Review queue' ? ['Pending', 'Under Review'].includes(l.status) && !l.queueClosed : statusFilter === 'Active repayments' ? ['Disbursed', 'Repaying'].includes(l.status) : l.status === statusFilter))).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const loanPage = data.section === 'loans' && data.pageMeta ? { items: loans, ...data.pageMeta } : paginate(loans, page, pageSize);
    const auditPage = data.section === 'audit' && data.pageMeta ? { items: filteredActivities, ...data.pageMeta } : paginate(filteredActivities, page, pageSize);
    const pagination = (result: ReturnType<typeof paginate>, label: string) => <Pagination {...result} label={label} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}/>;
    function openActivityRecords(activity: State['audit'][number]) {
        const relatedLoanId = activityLoanId(activity, data!.loans);
        if (relatedLoanId) { setSelectedActivity(null); router.push('/admin/loans/' + encodeURIComponent(relatedLoanId)); return; }
        const relatedMemberId = activityMemberId(activity, data!.members);
        if (relatedMemberId) { setSelectedActivity(null); router.push('/admin/members/' + encodeURIComponent(relatedMemberId)); return; }
        const action = activity.action.toLowerCase();
        const target = action.includes('withdraw') ? 'Withdrawals' : action.includes('loan') ? 'Loans' : action.includes('dividend') ? 'Dividends' : action.includes('election') || action.includes('vote') ? 'Elections' : action.includes('payment') || action.includes('fee') ? 'Payments' : action.includes('announcement') ? 'Announcements' : action.includes('savings') || action.includes('contribution') ? 'Transactions' : action.includes('member') || action.includes('profile') || action.includes('account') || action.includes('administrator') ? 'Members' : 'Audit';
        setSelectedActivity(null);
        let term = '';
        if (target === 'Members') {
            const member = data!.members.find(m => m.id === activity.actor || m.number && activity.action.includes(m.number));
            if (member) term = member.number;
        }
        if (target === 'Audit') term = activity.action;
        setSearch(term);
        router.push(adminHref(target) + (term ? '?search=' + encodeURIComponent(term) : ''));
    }
    function activityRow(activity: State['audit'][number]) {
        return <button className="activity-item" key={activity.id} onClick={() => { const loan = activityLoanId(activity, data!.loans); if (loan) { router.push('/admin/loans/' + encodeURIComponent(loan)); return; } const id = activityMemberId(activity, data!.members); if (id) router.push('/admin/members/' + encodeURIComponent(id)); else setSelectedActivity(activity); }}><span className="activity-item-icon"><ShieldCheck size={18}/></span><span className="activity-item-copy"><strong>{activity.action}</strong><span>{actorName(activity.actor)}<span aria-hidden="true"> · </span><time dateTime={activity.createdAt}>{date(activity.createdAt)}</time></span></span><ChevronRight className="activity-item-arrow" size={18}/></button>;
    }
    return <WorkspaceFrame kind="admin" title={title} accountName={data.actor.name} refreshing={refreshing} onRefresh={refreshRecords} showHeading={!loanId} detail={memberId ? selectedMember?.name : selectedLoan ? 'Queue ' + selectedLoan.queue : undefined}><AdminContext.Provider value={{ data, busy, search, statusFilter, setSearch, setStatusFilter, memberId, loanId, selectedMember, selectedLoan, visibleMembers, memberPage, pendingMembers, pendingLoans, loans, loanPage, activities, filteredActivities, auditPage, memberName, matches, selectMember, saveButton, pagination, activityRow, changeView, mutate, submit }}>        {error && <div className="error" role="alert">{error}</div>}{notice && <div className="toast" role="status">{notice}</div>}
        
        {['/admin/transactions', '/admin/audit'].includes(pathname) && <label className="search-field"><input aria-label={`Search ${view.toLowerCase()}`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search"/></label>}




        
        {children}
        <dialog ref={activityDialog} className="activity-dialog" aria-labelledby="activity-dialog-title" onClose={() => setSelectedActivity(null)} onClick={event => { if (event.target === event.currentTarget) setSelectedActivity(null); }}>
            {selectedActivity && <div><div className="activity-dialog-heading"><h2 id="activity-dialog-title">Activity details</h2><button className="activity-close" aria-label="Close activity details" onClick={() => setSelectedActivity(null)}><X size={20}/></button></div><p className="activity-description">{selectedActivity.action}</p><dl className="activity-metadata"><div><dt>By</dt><dd>{actorName(selectedActivity.actor)}</dd></div><div><dt>Date</dt><dd>{date(selectedActivity.createdAt)}</dd></div><div><dt>Reference</dt><dd>{selectedActivity.id}</dd></div></dl><button className="button primary" onClick={() => openActivityRecords(selectedActivity)}>Open related records<ChevronRight size={16}/></button></div>}
        </dialog>
</AdminContext.Provider></WorkspaceFrame>;
}
