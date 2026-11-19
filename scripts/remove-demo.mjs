import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { removeDemoData } from '../src/lib/remove-demo.ts';
nextEnv.loadEnvConfig(process.cwd());
const uri = process.env.MONGODB_URI;
async function clean(state) {
    const removed = removeDemoData(state);
    return { removed, changed: Object.values(removed).some(count => count > 0), administrators: state.members.filter(m => m.role === 'admin').length };
}
if (uri) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
    try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DB || 'ikhwaan');
        const collection = db.collection('portal');
        const doc = await collection.findOne({ _id: 'state' });
        if (!doc) console.log('No existing database records. New accounts will start without sample data.');
        else {
            const original = structuredClone(doc);
            const result = await clean(doc.data);
            if (result.changed) {
                await db.collection('portal_migration_backups').insertOne({ migration: 'remove-demo', createdAt: new Date(), source: original });
                const updated = await collection.updateOne({ _id: 'state', revision: doc.revision }, { $set: { data: doc.data }, $inc: { revision: 1 } });
                if (!updated.modifiedCount) throw new Error('Concurrent update detected. Retry cleanup.');
            }
            console.log(JSON.stringify(result));
        }
    } finally { await client.close(); }
} else {
    const directory = process.env.PORTAL_DATA_DIR || path.join(process.cwd(), '.data');
    const file = path.join(directory, 'portal.json');
    try {
        const original = await readFile(file, 'utf8');
        const state = JSON.parse(original), result = await clean(state);
        if (result.changed) {
            await writeFile(path.join(directory, `before-remove-demo-${Date.now()}.json`), original, { mode: 0o600 });
            await writeFile(file, JSON.stringify(state), { mode: 0o600 });
        }
        console.log(JSON.stringify(result));
    } catch (error) { if (error.code === 'ENOENT') console.log('No local records to clean.'); else throw error; }
}

const { closeMongoConnections } = await import('../src/lib/mongodb.ts');
await closeMongoConnections();
