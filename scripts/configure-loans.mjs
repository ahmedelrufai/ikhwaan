// Trusted local operations command; uses .env.local without printing credentials.
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const { withState } = await import('../src/lib/store.ts');
const { loanAdminAction } = await import('../src/lib/loans.ts');
const [email, combination, documents] = process.argv.slice(2);
if (!email || !['A+B', 'All four'].includes(combination) || !['optional', 'required'].includes(documents)) throw new Error('Usage: node --experimental-strip-types scripts/configure-loans.mjs admin-email "A+B" optional');
const result = await withState(state => {
    const owner = state.members.find(m => m.email.toLowerCase() === email.toLowerCase() && m.role === 'admin' && m.status === 'Active');
    if (!owner) throw new Error('Designated active administrator not found.');
    owner.managesLoanPolicy = true;
    loanAdminAction(state, owner, { action: 'loan-policy', approvalCombination: combination, documentRequired: documents === 'required' });
    return { approvalCombination: state.loanPolicy.approvalCombination, documentRequired: state.loanPolicy.documentRequired, assignedOffices: state.members.filter(m => m.office).map(m => m.office) };
}, true);
console.log(JSON.stringify(result));

const { closeMongoConnections } = await import('../src/lib/mongodb.ts');
await closeMongoConnections();
