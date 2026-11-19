// Explicit read-only regression check against the configured MongoDB. Never creates sessions or records.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
if (!process.argv.includes('--live')) throw new Error('Use --live to run read-only checks against the configured MongoDB.');
nextEnv.loadEnvConfig(process.cwd());
const { withState, memberForSession } = await import('../src/lib/store.ts');
const { closeMongoConnections } = await import('../src/lib/mongodb.ts');
try {
    if (!process.env.MONGODB_URI) throw new Error('MongoDB is not configured.');
    const existing = await withState(state => state.members[0], false, ['members']);
    assert.ok(existing, 'An existing account is required for the positive lookup check.');
    const version = existing.sessionVersion || 0;
    const found = await memberForSession(existing.id, version);
    assert.equal(found?.id, existing.id);
    assert.equal(await memberForSession(existing.id, version + 1), null);
    assert.equal(await memberForSession(randomUUID(), 0), null);
    assert.equal(await memberForSession('$data.members', 0), null);
    console.log('MongoDB session lookup passed: matching account, revoked version, missing account and literal ID handling. No records changed.');
} catch { console.error('MongoDB session lookup checks failed. Check database connectivity and configuration.'); process.exitCode = 1; }
finally { await closeMongoConnections(); }
