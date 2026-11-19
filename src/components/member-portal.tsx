'use client';
import WorkspaceFrame from '@/components/workspace-frame';
import WorkspaceSkeleton from '@/components/workspace-skeleton';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownLeft, Check, X } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { ActionButton } from '@/components/action-feedback';
import { validateBankDetails } from '@/lib/bank-details';
import { MemberPortalContext, money, date, type PortalData as Data } from '@/components/portal/portal-context';
import { portalPage, portalHref, portalPageTitle } from '@/lib/portal-routes';
import type { Loan } from '@/lib/store';
export default function Portal({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const view = portalPage(pathname).name;
    const title = portalPageTitle(pathname);
    const [data, setData] = useState<Data | null>(null);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [search, setSearch] = useState('');
    const dialogRef = useRef<HTMLElement>(null);
    const reading = useRef<{ controller: AbortController; promise: Promise<void> } | null>(null);
    const load = useCallback((inline = false): Promise<void> => {
        if (reading.current && !inline) return reading.current.promise;
        reading.current?.controller.abort();
        const controller = new AbortController();
        const promise = (async () => { try {
        const response = await fetch('/api/portal', { signal: controller.signal, cache: 'no-store' });
        if (controller.signal.aborted) return;
        if (response.ok) {
            const result = await response.json();
            if (controller.signal.aborted) return;
            setData(result);
            const reference = new URLSearchParams(window.location.search).get('payment_reference');
            if (reference) {
                window.history.replaceState({}, '', window.location.pathname);
                const verification = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', reference }) });
                const result = await verification.json();
                if (verification.ok) {
                    setNotice(result.message || 'Payment verification: ' + result.status);
                    window.location.replace(result.redirectTo || window.location.pathname);
                }
                else
                    setError(result.error);
            }
        }
        else if (response.status === 403) { const result = await response.json(); setData(null); window.location.replace(result.redirectTo || '/admin'); }
        else if (response.status === 401) { window.location.replace('/?next=' + encodeURIComponent(window.location.pathname + window.location.search)); return; }
        else { if (inline) throw new Error('Unable to refresh records. Try again.'); setError('Unable to load. Refresh to retry.'); }
    }
    catch (e) {
        if (controller.signal.aborted) return;
        if (inline) throw e;
        setError('Connection lost. Try again.');
    }
    finally {
        if (!controller.signal.aborted) setLoading(false);
        if (reading.current?.controller === controller) reading.current = null;
    } })();
        reading.current = { controller, promise };
        return promise;
    }, []);
    useEffect(() => {
        const refresh = () => { if (document.visibilityState !== 'hidden') void load(); };
        refresh();
        window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
        const timer = setInterval(refresh, 30000);
        return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); clearInterval(timer); reading.current?.controller.abort(); };
    }, [load]);
    useEffect(() => { setSearch(''); setError(''); setModal(''); }, [pathname]);
    useEffect(() => { if (!notice)
        return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
    useEffect(() => { if (!modal)
        return; const previous = document.activeElement as HTMLElement | null; const dialog = dialogRef.current; const elements = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not([type=hidden]), textarea, select, a[href]') || []); elements()[0]?.focus(); function keydown(event: KeyboardEvent) { if (event.key === 'Escape' && !busy) { setError(''); setModal(''); } if (event.key === 'Tab') {
        const items = elements();
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
        }
        else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    } } document.addEventListener('keydown', keydown); const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = overflow; previous?.focus(); }; }, [modal]);
    async function action(payload: Record<string, unknown>, inline = false) { setBusy(true); setError(''); try {
        if (payload.action === 'bank-account') Object.assign(payload, validateBankDetails(payload));
        const response = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok)
            throw new Error(result.error);
        try { await load(true); } catch { throw new Error('Saved, but records could not refresh. Please refresh.'); }
        setModal('');
        setNotice('Changes saved.');
        return true;
    }
    catch (e) {
        if (inline) throw e;
        setError((e as Error).message);
        return false;
    }
    finally {
        setBusy(false);
    } }
    async function verifyPayment(reference: string) {
        setBusy(true); setError('');
        try {
            const response = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', reference }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            if (result.redirectTo) { window.location.replace(result.redirectTo); return; }
            await load(true); setNotice(result.message || 'Payment: ' + result.status);
        } catch (e) { throw e; }
        finally { setBusy(false); }
    }
    async function startPayment() { setBusy(true); setError(''); try {
        const response = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'initialize' }) });
        const result = await response.json();
        if (!response.ok)
            throw new Error(result.error);
        window.location.assign(result.url);
    }
    catch (e) {
        setBusy(false);
        throw e;
    } }
    function applyForLoan(draft: Loan | null = null) {
        if (!data) return;
        const hasOpen = data.loans.some(loan => ['Approved', 'Awaiting Disbursement'].includes(loan.status) || ['Pending', 'Under Review'].includes(loan.status) && !(loan as Loan & { queueClosed?: boolean }).queueClosed);
        if (hasOpen) { router.push('/portal/loans'); return; }
        router.push('/portal/loans/new' + (draft ? '?draft=' + encodeURIComponent(draft.id) : ''));
    }
    function navigate(name: string) { router.push(portalHref(name)); }
    if (loading || !data) return <WorkspaceFrame kind="member" title={title} accountName={data?.member.name} office={data?.member.office}>{!loading && error ? <section className="panel workspace-load-error"><p role="alert">{error}</p><button className="button primary" onClick={() => void load(true).then(() => router.refresh()).catch(() => setError('Unable to refresh. Try again.'))}>Try again</button></section> : <WorkspaceSkeleton variant={view === 'Overview' ? 'overview' : pathname.endsWith('/new') || pathname.endsWith('/edit') || pathname.endsWith('/add') || pathname.endsWith('/withdraw') ? 'form' : 'register'}/>}</WorkspaceFrame>;
    const { member } = data;
    const savings = data.transactions.filter(t => t.type === 'Savings').reduce((s, t) => s + t.amount, 0);
    const contributions = data.transactions.filter(t => t.type === 'Contribution').reduce((s, t) => s + t.amount, 0);
    const dividendTotal = data.dividends.reduce((sum, d) => sum + d.amount, 0);
    const months = Array.from({ length: 6 }, (_, i) => {
        const start = new Date(); start.setDate(1); start.setMonth(start.getMonth() - 5 + i);
        const entries = data.transactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === start.getFullYear() && d.getMonth() === start.getMonth(); });
        return { label: start.toLocaleDateString('en-GB', { month: 'short' }), savings: entries.filter(t => t.type === 'Savings').reduce((sum, t) => sum + t.amount, 0), contributions: entries.filter(t => t.type === 'Contribution').reduce((sum, t) => sum + t.amount, 0) };
    });
    const chartMax = Math.max(100, ...months.flatMap(m => [m.savings, m.contributions]));
    const hasActiveApplication = data.loans.some(loan => ['Approved', 'Awaiting Disbursement'].includes(loan.status) || ['Pending', 'Under Review'].includes(loan.status) && !(loan as Loan & { queueClosed?: boolean }).queueClosed);
    const transactionTable = <div className="table-scroll"><table><thead><tr><th>Transaction</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{data.transactions.filter(t => t.description.toLowerCase().includes(search.toLowerCase())).map(t => <tr key={t.id}><td><div className="transaction"><span className={'transaction-icon ' + (t.type === 'Savings' ? 'blue' : '')}><ArrowDownLeft size={18}/></span><div><strong>{t.description}</strong><small>{t.type}</small></div></div></td><td>{date(t.date)}</td><td className="amount">{money(t.amount)}</td><td><span className="badge"><i />{t.status}</span></td></tr>)}</tbody></table>{!data.transactions.length && <div className="empty">No transactions yet.</div>}</div>;
    return <WorkspaceFrame kind="member" title={title} heading={view === 'Overview' ? `Welcome back, ${member.name.split(' ')[0]}` : title} accountName={member.name} office={member.office} announcementCount={data.announcements.length}><MemberPortalContext.Provider value={{ data, member, savings, contributions, dividendTotal, months, chartMax, hasActiveApplication, busy, error, search, setSearch, setError, setModal, action, applyForLoan, navigate, startPayment, verifyPayment, transactionTable }}>{error && !modal && <div role="alert" className="error">{error}</div>}{notice && <div className="toast" role="status"><Check size={18}/>{notice}</div>}
    {children}
    <footer className="page-footer"><span>© {new Date().getFullYear()} Ikhwaan Cooperative</span></footer>
    {modal.startsWith('cancel:') && <div className="modal-backdrop" onClick={() => { if (!busy) setModal(''); }}><section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="cancel-loan-title" onClick={e => e.stopPropagation()}><button className="modal-close" disabled={busy} aria-label="Close dialog" onClick={() => setModal('')}><X size={20}/></button><h2 id="cancel-loan-title">Cancel your application?</h2><p>Your application will leave the loan queue. Its history will remain available.</p><ActionButton className="button danger" disabled={busy} onAction={() => action({ action: 'cancel-loan', id: modal.slice(7) }, true)}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</ActionButton></section></div>}</MemberPortalContext.Provider></WorkspaceFrame>;
}
