import type { State } from './store.ts';
export function removeDemoData(state: State) {
    const identities = new Map([['demo-member', 'amina@ikhwaan.demo'], ['demo-admin', 'admin@ikhwaan.demo']]);
    const ids = new Set(state.members.filter(m => identities.get(m.id) === m.email).map(m => m.id));
    const removed: Record<string, number> = {};
    const before = state.members.length;
    state.members = state.members.filter(m => !ids.has(m.id));
    removed.members = before - state.members.length;
    for (const key of ['transactions', 'loans', 'withdrawals', 'payments', 'dividends'] as const) {
        const rows = state[key];
        if (rows) {
            const retained = rows.filter(row => !ids.has(row.memberId));
            removed[key] = rows.length - retained.length;
            Object.assign(state, { [key]: retained });
        }
    }
    for (const election of state.elections || []) election.votes = election.votes.filter(v => !ids.has(v.memberId));
    const announcementsBefore = state.announcements.length;
    const welcomeBodies = ['Welcome to Ikhwaan Cooperative.', 'Welcome to your cooperative portal. Keep track of your contributions, stay informed, and take the next step toward your financial goals.'];
    state.announcements = state.announcements.filter(a => !(a.id === 'welcome' && a.title === 'A stronger community, together' && welcomeBodies.includes(a.body)));
    removed.announcements = announcementsBefore - state.announcements.length;
    // Preserve all audit history and real members, including any renamed seeded accounts.
    return removed;
}
