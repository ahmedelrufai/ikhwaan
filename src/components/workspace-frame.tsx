'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Bell, ChevronRight, CreditCard, FileText, HandCoins, LayoutDashboard, LogOut, Megaphone, Menu, ShieldCheck, Sprout, Users, Vote, Wallet } from 'lucide-react';
import { ActionButton } from '@/components/action-feedback';
import { ADMIN_PAGES, adminPage } from '@/lib/admin-routes';
import { PORTAL_PAGES, portalPage } from '@/lib/portal-routes';
const icons: Record<string, typeof Users> = { Overview: LayoutDashboard, Members: Users, Transactions: Wallet, Loans: HandCoins, Repayments: CreditCard, Withdrawals: FileText, Payments: CreditCard, Dividends: Sprout, Elections: Vote, Announcements: Megaphone, Audit: ShieldCheck, 'Savings & contributions': Wallet, 'Emergency loans': HandCoins, 'Bank account': CreditCard, 'My membership': Users };
export default function WorkspaceFrame({ kind, title, heading, accountName, office, announcementCount, refreshing = false, onRefresh, detail, showHeading = true, children }: {
    kind: 'admin' | 'member'; title: string; heading?: string; accountName?: string; office?: string; announcementCount?: number;
    refreshing?: boolean; onRefresh?: () => Promise<void>; detail?: string; showHeading?: boolean; children: ReactNode;
}) {
    const pathname = usePathname();
    const admin = kind === 'admin';
    const pages = admin ? ADMIN_PAGES : PORTAL_PAGES;
    const active = admin ? adminPage(pathname).href : portalPage(pathname).href;
    const [mobile, setMobile] = useState(false);
    useEffect(() => { setMobile(false); }, [pathname]);
    return <div className={'app-shell' + (admin ? ' admin-shell' : '')}>
        <a className="workspace-skip" href="#workspace-content">Skip to page content</a>
        {mobile && <button className="scrim" aria-label="Close menu" onClick={() => setMobile(false)}/>}
        <aside className={'sidebar ' + (mobile ? 'open' : '')} aria-label={admin ? 'Administration navigation' : 'Member navigation'}>
            <div className="brand"><div>IKHWAAN{!admin && <small>MULTIPURPOSE COOPERATIVE</small>}</div></div>
            <div className="workspace">{admin ? <ShieldCheck size={18}/> : <span className="workspace-icon"><Users size={18}/></span>}<div>{admin ? 'Administration' : 'Member portal'}</div></div>
            <nav>{pages.map(({ name, href }) => { const Icon = icons[name] || FileText; return <Link key={href} href={href} onClick={() => setMobile(false)} className={active === href ? 'active' : ''} aria-current={active === href ? 'page' : undefined}><Icon size={18}/>{name}{name === 'Announcements' && !!announcementCount && <span className="nav-count">{announcementCount}</span>}</Link>; })}{!admin && office && <Link className="member-admin-link" href="/admin"><ShieldCheck size={18}/>Administration</Link>}</nav>
            <div className="sidebar-bottom"><ActionButton className="logout" onAction={async () => { const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); if (!response.ok) throw new Error('Unable to sign out. Try again.'); window.location.assign(admin ? '/admin/login' : '/'); }}><LogOut size={18}/>Sign out</ActionButton><div className="sidebar-footer">{accountName ? <div><strong>{accountName}</strong>{!admin && <small>Cooperative member</small>}</div> : <span className="skeleton-block skeleton-account" aria-label="Loading account"/>}</div></div>
        </aside>
        <div className="main-shell"><header className="topbar"><div><button className="menu-button" aria-label="Open menu" aria-expanded={mobile} onClick={() => setMobile(!mobile)}><Menu/></button><span className="breadcrumb">{admin ? 'Admin' : 'Member portal'}<ChevronRight size={14}/><strong>{title}</strong>{detail && <><ChevronRight size={14}/><span>{detail}</span></>}</span></div>{admin ? <ActionButton className="text-button" disabled={!onRefresh || refreshing} onAction={() => onRefresh?.()}>{refreshing ? 'Refreshing…' : 'Refresh'}</ActionButton> : <Link className="notification" aria-label="View announcements" href="/portal/announcements"><Bell size={20}/></Link>}</header>
        <main id="workspace-content" className={'content' + (admin ? ' admin-content' : '')} tabIndex={-1}>{showHeading && <div className="page-heading"><h1>{heading || title}{!admin && <span className="heading-dot">.</span>}</h1>{!admin && <span className="today">{new Date().toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>}</div>}{children}</main></div>
    </div>;
}
