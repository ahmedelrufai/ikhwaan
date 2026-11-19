import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountDestination, memberDashboardAllowed } from '../src/lib/access.ts';
test('only approved, active members can access the dashboard', () => {
    for (const status of ['Pending review', 'Rejected', 'Suspended', 'Withdrawn', '', 'Unknown']) {
        assert.equal(memberDashboardAllowed({ role: 'member', status }), false);
        assert.equal(accountDestination({ role: 'member', status }), '/application-status');
    }
    assert.equal(memberDashboardAllowed({ role: 'member', status: 'Active' }), true);
    assert.equal(accountDestination({ role: 'member', status: 'Active' }), '/portal');
    assert.equal(memberDashboardAllowed({ role: 'admin', status: 'Active' }), false);
    assert.equal(accountDestination({ role: 'admin', status: 'Active' }), '/admin');
});

test('an assigned official keeps member access and gains a separate admin workspace', async () => {
    const { administrativeAccess } = await import('../src/lib/access.ts');
    const official = { role: 'member', status: 'Active', office: 'Financial Secretary' };
    assert.equal(memberDashboardAllowed(official), true);
    assert.equal(administrativeAccess(official), true);
    assert.equal(administrativeAccess({ ...official, office: undefined }), false);
    assert.equal(administrativeAccess({ ...official, status: 'Suspended' }), false);
    assert.equal(administrativeAccess({ ...official, office: 'Invented office' }), false);
});
