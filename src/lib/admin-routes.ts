export const ADMIN_PAGES = [
    { name: 'Overview', href: '/admin' },
    { name: 'Members', href: '/admin/members' },
    { name: 'Transactions', href: '/admin/transactions' },
    { name: 'Loans', href: '/admin/loans' },
    { name: 'Repayments', href: '/admin/repayments' },
    { name: 'Withdrawals', href: '/admin/withdrawals' },
    { name: 'Contributions', href: '/admin/contributions' },
    { name: 'Payments', href: '/admin/payments' },
    { name: 'Dividends', href: '/admin/dividends' },
    { name: 'Elections', href: '/admin/elections' },
    { name: 'Announcements', href: '/admin/announcements' },
    { name: 'Audit', href: '/admin/audit' },
] as const;
export const ADMIN_ACTION_PAGES: Record<string, string> = {
    '/admin/contributions/new': 'Create contribution',
    '/admin/loans/settings': 'Loan settings',
    '/admin/transactions/new': 'Record transaction',
    '/admin/payments/settings': 'Payment settings',
    '/admin/dividends/new': 'Allocate dividend',
    '/admin/elections/new': 'Schedule ballot',
    '/admin/announcements/new': 'Publish announcement',
};
export function adminHref(name: string) { if (name === 'Loan settings') return '/admin/loans/settings'; return ADMIN_PAGES.find(page => page.name === name)?.href || '/admin'; }
export function adminPage(pathname: string) {
    return ADMIN_PAGES.find(page => page.href !== '/admin' && (pathname === page.href || pathname.startsWith(page.href + '/'))) || ADMIN_PAGES[0];
}
export function adminPageTitle(pathname: string) {
    if (/^\/admin\/contributions\/[^/]+\/edit$/.test(pathname)) return 'Edit contribution';
    if (ADMIN_ACTION_PAGES[pathname]) return ADMIN_ACTION_PAGES[pathname];
    if (/^\/admin\/members\/[^/]+$/.test(pathname)) return 'Member details';
    if (/^\/admin\/loans\/[^/]+$/.test(pathname)) return 'Loan details';
    return adminPage(pathname).name;
}
export function safeAdminPath(value: string) {
    if (/^\/admin\/contributions\/[A-Za-z0-9_-]+\/edit$/.test(value)) return true;
    if (ADMIN_PAGES.some(page => page.href === value) || Object.hasOwn(ADMIN_ACTION_PAGES, value)) return true;
    if (/^\/admin\/(?:members|loans)\/[A-Za-z0-9_-]+$/.test(value)) return true;
    return /^\/admin\/(?:members|transactions|loans|payments|audit)\?search=[A-Za-z0-9_%.-]{1,1000}$/.test(value);
}

export function adminReadForPath(pathname: string) {
    const actions: Record<string, string> = {
        '/admin/loans/settings': 'loan-settings',
        '/admin/transactions/new': 'new-transaction', '/admin/payments/settings': 'payment-settings',
        '/admin/dividends/new': 'new-dividend', '/admin/elections/new': 'new-election', '/admin/announcements/new': 'new-announcement',
    };
    if (pathname === '/admin/contributions/new' || /^\/admin\/contributions\/[^/]+\/edit$/.test(pathname)) return 'contributions';
    if (actions[pathname]) return actions[pathname];
    if (/^\/admin\/members\/[^/]+$/.test(pathname)) return 'member-details';
    if (/^\/admin\/loans\/[^/]+$/.test(pathname)) return 'loan-details';
    return pathname === '/admin' ? 'overview' : adminPage(pathname).href.slice('/admin/'.length);
}
