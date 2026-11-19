import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectionCache } from '../src/lib/mongodb.ts';
import { withState } from '../src/lib/store.ts';

test('parallel requests share a single connection attempt; failed attempts can recover', async () => {
    let connects = 0, closes = 0;
    const cache = connectionCache(async () => { connects++; return { close: async () => { closes++; } }; });
    const clients = await Promise.all(Array.from({ length: 12 }, () => cache.get('same-database')));
    assert.equal(connects, 1); assert.ok(clients.every(client => client === clients[0]));
    await cache.close(); assert.equal(closes, 1);
    await cache.get('same-database'); assert.equal(connects, 2); await cache.close();
    let attempts = 0;
    const failing = connectionCache(async () => { if (++attempts === 1) throw new Error('Unavailable'); return { close: async () => {} }; });
    await assert.rejects(failing.get('database'), /Unavailable/);
    await failing.get('database'); assert.equal(attempts, 2); await failing.close();
});
test('local reads can overlap and concurrent writes preserve all updates', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ikhwaan-concurrent-'));
    const previous = { uri: process.env.MONGODB_URI, directory: process.env.PORTAL_DATA_DIR };
    process.env.MONGODB_URI = ''; process.env.PORTAL_DATA_DIR = directory;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    try {
        await withState(state => { state.announcements = []; }, true);
        const first = withState(async () => { entered(); await gate; });
        await started;
        const second = await Promise.race([withState(() => 'parallel read completed'), new Promise<string>(resolve => setTimeout(() => resolve('blocked'), 500))]);
        assert.equal(second, 'parallel read completed'); release(); await first;
        await Promise.all(Array.from({ length: 12 }, (_, index) => withState(state => { state.announcements.push({ id: String(index), title: 'Entry', body: '', category: '', createdAt: new Date().toISOString() }); }, true)));
        assert.equal(await withState(state => state.announcements.length), 12);
        await assert.rejects(withState(() => {}, true, ['members']), /complete state/);
    } finally {
        release();
        if (previous.uri === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = previous.uri;
        if (previous.directory === undefined) delete process.env.PORTAL_DATA_DIR; else process.env.PORTAL_DATA_DIR = previous.directory;
        await rm(directory, { recursive: true, force: true });
    }
});

test('MongoDB cold-connection deadlines are configurable and invalid values fall back safely', async () => {
    const { mongoConnectionOptions } = await import('../src/lib/mongodb.ts');
    const previous = { selection: process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, connect: process.env.MONGODB_CONNECT_TIMEOUT_MS };
    try {
        delete process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS; delete process.env.MONGODB_CONNECT_TIMEOUT_MS;
        assert.equal(mongoConnectionOptions().serverSelectionTimeoutMS, 30000);
        assert.equal(mongoConnectionOptions().connectTimeoutMS, 10000);
        process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS = '45000'; process.env.MONGODB_CONNECT_TIMEOUT_MS = '15000';
        assert.equal(mongoConnectionOptions().serverSelectionTimeoutMS, 45000);
        assert.equal(mongoConnectionOptions().connectTimeoutMS, 15000);
        process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS = 'NaN'; process.env.MONGODB_CONNECT_TIMEOUT_MS = '0';
        assert.equal(mongoConnectionOptions().serverSelectionTimeoutMS, 30000);
        assert.equal(mongoConnectionOptions().connectTimeoutMS, 10000);
    } finally {
        if (previous.selection === undefined) delete process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS; else process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS = previous.selection;
        if (previous.connect === undefined) delete process.env.MONGODB_CONNECT_TIMEOUT_MS; else process.env.MONGODB_CONNECT_TIMEOUT_MS = previous.connect;
    }
});
