import { sendEmail } from './email.ts';
import { loanEmailTasks, type LoanEmail } from './loan-notifications.ts';
import { withState } from './store.ts';

export function loanEmailConfiguration() {
    const user = process.env.EMAIL_USER;
    const password = process.env.EMAIL_PASSWORD?.replace(/\s/g, '');
    const from = process.env.LOAN_EMAIL_FROM || user;
    const configuredUrl = process.env.APP_URL;
    if (!user || !password || !from || !configuredUrl) return;
    try {
        const url = new URL(configuredUrl);
        if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return;
        if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return;
        return { user, password, from, origin: url.origin };
    } catch { return; }
}

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export function renderLoanEmail(email: LoanEmail, origin: string) {
    const url = new URL(email.path, origin).toString();
    const text = `Hello ${email.name},\n\n${email.message}\n\nLoan reference: ${email.reference}\n\n${email.button}: ${url}\n\nSign in with your own account to continue. Opening this link does not approve a loan or record a transfer.\n\nIkhwaan Cooperative`;
    const html = `<!doctype html><html><body style="margin:0;background:#f4f7f2;font-family:Arial,sans-serif;color:#20392c"><main style="max-width:560px;margin:32px auto;padding:32px;background:white;border-radius:12px"><p style="font-weight:bold;color:#216a50">IKHWAAN COOPERATIVE</p><h1 style="font-size:24px">${escape(email.subject)}</h1><p>Hello ${escape(email.name)},</p><p style="line-height:1.7">${escape(email.message)}</p><p>Loan reference: <strong>${escape(email.reference)}</strong></p><p style="margin:28px 0"><a href="${escape(url)}" style="display:inline-block;padding:14px 22px;background:#216a50;color:white;text-decoration:none;border-radius:8px;font-weight:bold">${escape(email.button)}</a></p><p style="font-size:13px;line-height:1.6;color:#58685e">Sign in with your own account to continue. Opening this link does not approve a loan or record a transfer.</p><p style="font-size:12px;word-break:break-all">If the button does not work, open:<br/><a href="${escape(url)}">${escape(url)}</a></p></main></body></html>`;
    return { subject: `${email.subject} · ${email.reference}`, html, text };
}

export type EmailTransport = { sendMail: (message: { from: string; to: string; subject: string; html: string; text: string; messageId: string }) => Promise<{ accepted?: unknown[]; rejected?: unknown[] }> };
export async function sendLoanEmail(email: LoanEmail, config: NonNullable<ReturnType<typeof loanEmailConfiguration>>, transport?: EmailTransport) {
    await sendEmail({ from: config.from, to: email.email, ...renderLoanEmail(email, config.origin), messageId: `<loan-${email.id}@${new URL(config.origin).hostname}>` }, transport);
}

/** Persisted leases prevent concurrent workers claiming the same email. Network calls happen after commit. */
export async function deliverLoanEmails(limit = 3, transport?: EmailTransport) {
    const config = loanEmailConfiguration();
    if (!config) return { configured: false, sent: 0 };
    let sent = 0;
    for (let index = 0; index < limit; index++) {
        const email = await withState(state => {
            const now = new Date();
            const tasks = new Set(loanEmailTasks(state, now).map(t => t.key));
            for (const item of state.loanEmails || []) {
                if (!['Pending', 'Sending'].includes(item.status)) continue;
                if (item.status === 'Sending' && item.leaseUntil && new Date(item.leaseUntil) > now) continue;
                if (!tasks.has(item.key)) { item.status = 'Cancelled'; continue; }
                if (item.nextAttemptAt && new Date(item.nextAttemptAt) > now) continue;
                // Bound automatic retries; SMTP cannot guarantee exactly-once delivery after an ambiguous timeout.
                if (item.attempts && item.firstAttemptAt && now.getTime() - new Date(item.firstAttemptAt).getTime() > 23 * 60 * 60 * 1000) {
                    item.lastError = 'Automatic retry window ended; check provider delivery before retrying manually.';
                    continue;
                }
                item.status = 'Sending'; item.attempts++; item.firstAttemptAt ??= now.toISOString();
                item.leaseUntil = new Date(now.getTime() + 120000).toISOString();
                return structuredClone(item);
            }
        }, true);
        if (!email) break;
        let failure: string | undefined;
        try { await sendLoanEmail(email, config, transport); } catch (error) { failure = error instanceof Error && /^Email provider/.test(error.message) ? error.message : 'Email delivery failed; retry scheduled.'; }
        await withState(state => {
            const item = state.loanEmails?.find(e => e.id === email.id);
            if (!item || item.status !== 'Sending' || item.leaseUntil !== email.leaseUntil) return;
            delete item.leaseUntil;
            if (failure) {
                item.status = 'Pending'; item.lastError = failure;
                item.nextAttemptAt = new Date(Date.now() + Math.min(60 * 60 * 1000, 60000 * 2 ** Math.min(item.attempts - 1, 6))).toISOString();
            } else {
                item.status = 'Sent'; item.sentAt = new Date().toISOString();
                delete item.lastError; delete item.nextAttemptAt;
            }
        }, true);
        if (!failure) sent++;
    }
    return { configured: true, sent };
}
