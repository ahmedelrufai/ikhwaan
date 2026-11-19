import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PORTAL_PAGES, portalPage, portalPageTitle, safePortalPath } from '../src/lib/portal-routes.ts';
import { safeLoanDestination } from '../src/lib/loan-links.ts';
test('each member section has a distinct URL and nested actions keep their parent navigation', () => {
    assert.equal(new Set(PORTAL_PAGES.map(page => page.href)).size, 9);
    for (const page of PORTAL_PAGES) assert.equal(portalPage(page.href).name, page.name);
    assert.equal(portalPage('/portal/loans/new').name, 'Emergency loans');
    assert.equal(portalPageTitle('/portal/loans/new'), 'Apply for emergency loan');
    assert.equal(portalPage('/portal/membership/edit').name, 'My membership');
    assert.equal(portalPageTitle('/portal/loans/loan-1'), 'Loan details');
});
test('member sign-in preserves page destinations and rejects redirects outside the portal', () => {
    const active = { role: 'member', status: 'Active' } as const;
    for (const path of [...PORTAL_PAGES.map(p => p.href), '/portal/loans/loan-1', '/portal/loans/loan-1/pay', '/portal/loans/loan-1/pay?payment_reference=ikh_00000000-0000-0000-0000-000000000000', '/portal/loans/loan-1/pay', '/portal/loans/new?draft=draft-1', '/portal/membership/edit', '/portal/membership/withdraw', '/portal/bank-account/add?returnTo=loan', '/portal/payments?payment_reference=IKH-123']) {
        assert.ok(safePortalPath(path)); assert.equal(safeLoanDestination(path, active), path);
        assert.equal(safeLoanDestination(path, { ...active, profileStatus: 'Incomplete' }), undefined);
        assert.equal(safeLoanDestination(path, { ...active, status: 'Pending review' }), undefined);
    }
    for (const path of ['//evil.example/portal', 'https://evil.example/portal', '/portal/../admin', '/portal/loans/%2e%2e', '/portal/membership/edit?next=evil', '/portal/payments?payment_reference=x&next=evil']) {
        assert.equal(safePortalPath(path), false); assert.equal(safeLoanDestination(path, active), undefined);
    }
});
