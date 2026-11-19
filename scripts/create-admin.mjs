// Trusted administrator provisioning; email OTP is required at sign-in.
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
import { randomInt, randomUUID } from 'node:crypto';
loadEnvConfig(process.cwd());
const { withState, audit } = await import('../src/lib/store.ts');
const email = String(process.argv[2] || '').trim().toLowerCase();
const name = String(process.argv[3] || '').trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) throw new Error('Usage: node --experimental-strip-types scripts/create-admin.mjs email "Full name"');
await withState(state => {
    if (state.members.some(m => m.email === email)) throw new Error('Email already registered.');
    let number;
    do { number = String(randomInt(10000000000, 99999999999)); } while (state.members.some(m => m.number === number));
    const id = randomUUID();
    state.members.push({ id, number, name, email, password: '', role: 'admin', status: 'Active', outstanding: 0, phone: '', address: '', occupation: '', officeAddress: '', nationality: '', state: '', lga: '', gender: '', kinName: '', kinRelationship: '', kinAddress: '', kinPhone: '', kinEmail: '' });
    audit(state, id, 'Administrator provisioned through local CLI');
}, true);
console.log('Administrator created. Sign in at /admin/login.');

const { closeMongoConnections } = await import('../src/lib/mongodb.ts');
await closeMongoConnections();
