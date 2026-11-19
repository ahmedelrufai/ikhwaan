import { MongoClient } from 'mongodb';
/** Share pending connections as well as established pools, including across development reloads. */
export function connectionCache<T extends {
    close: () => Promise<unknown>;
}>(connect: (key: string) => Promise<T>) {
    const entries = new Map<string, Promise<T>>();
    return {
        get(key: string): Promise<T> {
            let pending = entries.get(key);
            if (!pending) {
                pending = Promise.resolve().then(() => connect(key)).catch(error => { if (entries.get(key) === pending)
                    entries.delete(key); throw error; });
                entries.set(key, pending);
            }
            return pending;
        },
        async close() {
            const pending = [...entries.values()];
            entries.clear();
            await Promise.allSettled(pending.map(async (item) => (await item).close()));
        },
    };
}
export function mongoConnectionOptions() {
    const duration = (value: string | undefined, fallback: number) => {
        const parsed = Number(value);
        return value && Number.isInteger(parsed) && parsed >= 1000 && parsed <= 120000 ? parsed : fallback;
    };
    return {
        maxPoolSize: 20, minPoolSize: 0, maxIdleTimeMS: 60000,
        serverSelectionTimeoutMS: duration(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 30000),
        connectTimeoutMS: duration(process.env.MONGODB_CONNECT_TIMEOUT_MS, 10000),
    };
}
const globals = globalThis as typeof globalThis & {
    ikhwaanMongoPool?: ReturnType<typeof connectionCache<MongoClient>>;
    ikhwaanMongoPoolV2?: ReturnType<typeof connectionCache<MongoClient>>;
};
// A new cache version replaces the old five-second factory retained by development hot reloads.
const pools = globals.ikhwaanMongoPoolV2 ??= connectionCache(async (key) => {
    const { uri, options } = JSON.parse(key) as { uri: string; options: ReturnType<typeof mongoConnectionOptions> };
    const client = new MongoClient(uri, options);
    try { await client.connect(); return client; }
    catch (error) { await client.close().catch(() => {}); throw error; }
});
export async function mongoClient() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MongoDB is not configured.');
    return pools.get(JSON.stringify({ uri, options: mongoConnectionOptions() }));
}
export async function closeMongoConnections() {
    await Promise.all([pools.close(), globals.ikhwaanMongoPool?.close()]);
}
