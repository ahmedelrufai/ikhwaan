// Explicit, disposable filesystem fixture. Never loads .env.local or connects to MongoDB.
import { resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
if (process.env.MONGODB_URI || !process.env.PORTAL_DATA_DIR || !resolve(process.env.PORTAL_DATA_DIR).startsWith(resolve(tmpdir()) + sep) && !resolve(process.env.PORTAL_DATA_DIR).startsWith('/private/tmp/')) throw new Error('Use a disposable temporary PORTAL_DATA_DIR and no MongoDB URI.');
const { withState, hash } = await import('../src/lib/store.ts');
await withState(state => {
    if (state.members.length) throw new Error('Test fixtures require empty storage.');
    const member = { id: 'qa-member', number: '10000000001', name: 'QA Member', email: 'member@example.test', password: hash('TestMember123!'), role: 'member', status: 'Active', phone: '08012345678', address: '12 QA Road', occupation: 'Tester', officeAddress: '14 QA Road', nationality: 'Nigerian', state: 'Lagos', lga: 'Ikeja', gender: 'Female', kinName: 'QA Relative', kinRelationship: 'Sister', kinAddress: '16 QA Road', kinPhone: '08012349876', kinEmail: 'relative@example.test', outstanding: 0 };
    state.members.push(member, { ...member, id: 'qa-admin', number: '10000000002', email: 'admin@example.test', password: hash('TestAdmin123!'), role: 'admin', office: 'Treasurer', managesLoanPolicy: true, name: 'QA Admin', phone: '08087654321' });
    for (const [office, email] of [['President', 'president@example.test'], ['Secretary General', 'secretary@example.test'], ['Financial Secretary', 'finance@example.test']]) { state.members.push({ ...member, id: 'qa-' + office, number: String(10000000003 + state.members.length), email, password: hash('TestOfficial123!'), role: 'admin', office, name: 'QA ' + office }); }
}, true);
console.log('Disposable test fixtures created.');
