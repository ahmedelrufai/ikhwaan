import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, type Member } from '../src/lib/store.ts';
import { removeDemoData } from '../src/lib/remove-demo.ts';
test('new stores are empty regardless of legacy environment flags', () => {
    const old = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'true';
    const state = emptyState();
    assert.equal(state.members.length, 0);
    assert.equal(state.transactions.length, 0);
    assert.equal(state.announcements.length, 0);
    if (old === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = old;
});
test('cleanup removes only exact sample identities and their records and preserves audit history', () => {
    const state = emptyState();
    state.members = [{ id: 'demo-member', email: 'amina@ikhwaan.demo' }, { id: 'demo-admin', email: 'admin@ikhwaan.demo' }, { id: 'real', email: 'real@example.com' }] as Member[];
    state.transactions = [{ memberId: 'demo-member' }, { memberId: 'real' }] as typeof state.transactions;
    state.audit = [{ id: 'history', actor: 'demo-admin', action: 'Member activated', createdAt: '' }];
    assert.equal(removeDemoData(state).members, 2);
    assert.equal(state.members[0].id, 'real');
    assert.equal(state.transactions.length, 1);
    assert.equal(state.audit.length, 1);
    assert.equal(removeDemoData(state).members, 0);
});
test('cleanup preserves a renamed sample account used as a real account', () => {
    const state = emptyState();
    state.members = [{ id: 'demo-admin', email: 'real-admin@example.com' }] as Member[];
    assert.equal(removeDemoData(state).members, 0);
});

test('cleanup removes only the unchanged seeded welcome announcement', () => {
    const state = emptyState();
    state.announcements = [{ id: 'welcome', title: 'A stronger community, together', body: 'Welcome to Ikhwaan Cooperative.', category: 'Community', createdAt: '' }, { id: 'real', title: 'Meeting', body: 'Friday', category: 'Update', createdAt: '' }];
    assert.equal(removeDemoData(state).announcements, 1);
    assert.equal(state.announcements[0].id, 'real');
});
