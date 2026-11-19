import nextEnv from '@next/env';
import { setTimeout } from 'node:timers/promises';
nextEnv.loadEnvConfig(process.cwd());
const { deliverLoanEmails } = await import('../src/lib/loan-email-delivery.ts');
const watch = process.argv.includes('--watch');
do {
    try {
        const result = await deliverLoanEmails();
        console.log(result.configured ? `Loan email worker: ${result.sent} accepted by provider.` : 'Loan email worker: configure EMAIL_USER, EMAIL_PASSWORD and APP_URL; no emails sent.');
        if (!result.configured) { process.exitCode = 1; break; }
    } catch {
        console.error('Loan email worker failed; queued messages retained for retry.');
        if (!watch) process.exitCode = 1;
    }
    if (watch) await setTimeout(60000);
} while (watch);

const { closeMongoConnections } = await import('../src/lib/mongodb.ts');
await closeMongoConnections();
const { closeEmailConnections } = await import('../src/lib/email.ts');
await closeEmailConnections();
