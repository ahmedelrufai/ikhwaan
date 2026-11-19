export const PORTAL_PAGES = [
    { name: 'Overview', href: '/portal' },
    { name: 'Savings & contributions', href: '/portal/savings' },
    { name: 'Emergency loans', href: '/portal/loans' },
    { name: 'Payments', href: '/portal/payments' },
    { name: 'Dividends', href: '/portal/dividends' },
    { name: 'Elections', href: '/portal/elections' },
    { name: 'Announcements', href: '/portal/announcements' },
    { name: 'Bank account', href: '/portal/bank-account' },
    { name: 'My membership', href: '/portal/membership' },
] as const;
export function portalPage(pathname: string) {
    return PORTAL_PAGES.find(page => page.href !== '/portal' && (pathname === page.href || pathname.startsWith(page.href + '/'))) || PORTAL_PAGES[0];
}
export function portalHref(name: string) { return PORTAL_PAGES.find(page => page.name === name)?.href || '/portal'; }
export function safePortalPath(value: string) {
    if (PORTAL_PAGES.some(page => value === page.href)) return true;
    if (/^\/portal\/loans\/[A-Za-z0-9_-]+\/pay(?:\?payment_reference=ikh_[a-f0-9-]{36})?$/.test(value)) return true;
    if (/^\/portal\/payments\?payment_reference=[A-Za-z0-9_-]{1,200}$/.test(value)) return true;
    return /^\/portal\/(?:loans\/(?:[A-Za-z0-9_-]+|new\?draft=[A-Za-z0-9_-]+)|bank-account\/add(?:\?returnTo=loan)?|membership\/(?:edit|withdraw))$/.test(value);
}

export function portalPageTitle(pathname: string) {
    const actions: Record<string, string> = {
        '/portal/loans/new': 'Apply for emergency loan',
        '/portal/bank-account/add': 'Add bank account',
        '/portal/membership/edit': 'Edit profile',
        '/portal/membership/withdraw': 'Membership withdrawal',
    };
    if (/^\/portal\/loans\/[^/]+\/pay$/.test(pathname)) return 'Make loan payment';
    if (actions[pathname]) return actions[pathname];
    return /^\/portal\/loans\/[^/]+$/.test(pathname) ? 'Loan details' : portalPage(pathname).name;
}
