import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PAGES, ADMIN_ACTION_PAGES, adminHref, adminPage, adminPageTitle, safeAdminPath, adminReadForPath } from '../src/lib/admin-routes.ts';
import { safeLoanDestination } from '../src/lib/loan-links.ts';
test('each administration section has a distinct route and action pages keep the correct sidebar section', () => {
    assert.equal(new Set(ADMIN_PAGES.map(page => page.href)).size, 11);
    for (const page of ADMIN_PAGES) {
        assert.equal(adminHref(page.name), page.href);
        assert.equal(adminPage(page.href).name, page.name);
    }
    assert.equal(adminPage('/admin/members/member-1').name, 'Members');
    assert.equal(adminPageTitle('/admin/members/member-1'), 'Member details');
    assert.equal(adminPage('/admin/loans/loan-1').name, 'Loans');
    assert.equal(adminPageTitle('/admin/transactions/new'), 'Record transaction');
    assert.equal(adminPage('/admin/payments/settings').name, 'Payments');
});
test('admin sign-in preserves allowed pages and never grants members administrative access', () => {
    const admin = { role: 'admin', status: 'Active' } as const;
    const member = { role: 'member', status: 'Active' } as const;
    const official = { ...member, office: 'Treasurer' } as const;
    const routes = [...ADMIN_PAGES.map(page => page.href), ...Object.keys(ADMIN_ACTION_PAGES), '/admin/members/member-1', '/admin/loans/loan-1', '/admin/audit?search=Loan%20approved'];
    for (const path of routes) {
        assert.ok(safeAdminPath(path), path);
        assert.equal(safeLoanDestination(path, admin), path);
        assert.equal(safeLoanDestination(path, official), path);
        assert.equal(safeLoanDestination(path, member), undefined);
        assert.equal(safeLoanDestination(path, { ...admin, status: 'Suspended' }), undefined);
        assert.equal(safeLoanDestination(path, { ...official, profileStatus: 'Incomplete' }), undefined);
    }
    for (const path of ['https://evil.example/admin', '//evil.example/admin', '/admin/../portal', '/admin/members/%2e%2e', '/admin/login', '/admin/audit?next=https://evil.example', '/admin/loans/loan-1?search=x&next=bad', '/admin/missing']) {
        assert.equal(safeAdminPath(path), false, path);
        assert.equal(safeLoanDestination(path, admin), undefined);
    }
});
