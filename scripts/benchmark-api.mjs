// Synthetic payload comparison by default; --live performs read-only MongoDB timing checks.
import { performance } from 'node:perf_hooks';
import { adminSnapshot } from '../src/lib/admin-read.ts';
import { emptyState, withState } from '../src/lib/store.ts';
import { closeMongoConnections, mongoClient } from '../src/lib/mongodb.ts';
const live = process.argv.includes('--live');
let state = emptyState(), actor;
try {
    if (live) {
        const { default: nextEnv } = await import('@next/env'); nextEnv.loadEnvConfig(process.cwd());
        if (!process.env.MONGODB_URI) throw new Error('MongoDB is not configured.');
        const { MongoClient } = await import('mongodb');
        const time = async operation => { const started = performance.now(); await operation(); return +(performance.now() - started).toFixed(1); };
        const fresh = [], pooled = [], projected = [];
        for (let index = 0; index < 3; index++) fresh.push(await time(async () => {
            const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
            try { await client.connect(); await client.db(process.env.MONGODB_DB || 'ikhwaan').collection('portal').findOne({ _id: 'state' }); } finally { await client.close(); }
        }));
        await mongoClient();
        for (let index = 0; index < 3; index++) {
            pooled.push(await time(async () => { await withState(() => {}); }));
            projected.push(await time(async () => { await withState(() => {}, false, ['members']); }));
        }
        console.log(JSON.stringify({ readOnly: true, milliseconds: { freshConnectionFullRead: fresh, pooledFullRead: pooled, pooledMembersProjection: projected } }));
        state = await withState(value => value);
        actor = state.members.find(member => member.role === 'admin' && member.status === 'Active');
        if (!actor) throw new Error('No active administrator available for payload comparison.');
    } else {
        actor = { id: 'admin', role: 'admin', status: 'Active', name: 'Test Admin', email: 'admin@example.test', managesLoanPolicy: true };
        state.members.push(actor);
        for (let index = 0; index < 200; index++) {
            const member = { id: 'member-' + index, role: 'member', status: 'Active', name: 'Test Member ' + index, number: String(index + 10000000000), phone: '08012345678', email: `member${index}@example.test`, outstanding: 0 };
            state.members.push(member);
            state.loans.push({ id: 'loan-' + index, memberId: member.id, reference: 'IKH-' + index, amount: 1000000, status: 'Pending', reason: 'Synthetic application for payload measurement', createdAt: '2026-11-18T12:00:00Z', expiresAt: '2099-12-31T23:59:59+01:00', period: '2026-11', queue: index + 1 });
            for (let event = 0; event < 5; event++) state.audit.push({ id: `audit-${index}-${event}`, actor: actor.id, action: 'Synthetic event', createdAt: '2026-11-18T12:00:00Z', subject: { type: 'loan', id: 'loan-' + index } });
        }
    }
    const full = Buffer.byteLength(JSON.stringify(adminSnapshot(state, actor, new URLSearchParams())));
    const scoped = Buffer.byteLength(JSON.stringify(adminSnapshot(state, actor, new URLSearchParams({ section: 'loans', pageSize: '10' }))));
    console.log(JSON.stringify({ dataset: live ? 'configured database (read-only)' : 'synthetic: 200 members, 200 loans, 1000 audit events', fullResponseBytes: full, loanPageBytes: scoped, reductionPercent: +((1 - scoped / full) * 100).toFixed(1) }));
} catch { console.error('Benchmark could not complete. Check database connectivity and configuration.'); process.exitCode = 1; }
finally { await closeMongoConnections(); }
