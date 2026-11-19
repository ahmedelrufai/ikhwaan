// Restricted cleanup for applications without financial activity. Keeps audit, documents and a database backup.
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
nextEnv.loadEnvConfig(process.cwd());
const { savedBankAccount } = await import('../src/lib/loans.ts');
if (!process.env.MONGODB_URI) throw new Error('Configured MongoDB required.');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'ikhwaan'), collection = db.collection('portal');
    const doc = await collection.findOne({ _id: 'state' });
    if (!doc) throw new Error('State document not found.');
    const state = doc.data;
    if ((state.loanApprovals || []).length || (state.loanRepayments || []).length || (state.loanExceptions || []).length || state.transactions.some(t => t.loanId || ['Loan repayment', 'Loan disbursement'].includes(t.type)) || state.members.some(m => m.outstanding > 0) || state.loans.some(l => ['Disbursed', 'Repaying', 'Completed', 'Repaid'].includes(l.status) || l.pendingDisbursement)) throw new Error('Financial or review activity exists. This restricted cleanup will not proceed.');
    const removed = state.loans.length;
    if (!removed) console.log(JSON.stringify({ removed: 0, remaining: 0 }));
    else {
        await db.collection('portal_migration_backups').insertOne({ migration: 'clear-unfunded-loan-applications', createdAt: new Date(), source: structuredClone(doc) });
        for (const member of state.members) { const bank = savedBankAccount(state, member); if (bank) member.bankAccount ??= bank; }
        state.loans = [];
        state.audit.unshift({ id: randomUUID(), actor: 'system', action: `Cleared ${removed} unfunded loan application at owner request; backup retained`, createdAt: new Date().toISOString() });
        const updated = await collection.updateOne({ _id: 'state', revision: doc.revision }, { $set: { data: state }, $inc: { revision: 1 } });
        if (!updated.modifiedCount) throw new Error('Concurrent update detected; no applications cleared.');
        const verified = await collection.findOne({ _id: 'state' });
        if (verified.data.loans.length) throw new Error('Removal verification failed.');
        console.log(JSON.stringify({ removed, remaining: verified.data.loans.length, backupSaved: true, auditPreserved: true, supportingFilesPreserved: true }));
    }
} finally { await client.close(); }

const { closeMongoConnections } = await import('../src/lib/mongodb.ts');
await closeMongoConnections();
