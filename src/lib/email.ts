import type { Transporter } from 'nodemailer';
export type EmailMessage = {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    messageId: string;
};
export type EmailTransport = {
    sendMail: (message: EmailMessage) => Promise<{
        accepted?: unknown[];
        rejected?: unknown[];
    }>;
};
export function emailConfiguration() {
    const user = process.env.EMAIL_USER;
    const password = process.env.EMAIL_PASSWORD?.replace(/\s/g, '');
    const from = process.env.LOAN_EMAIL_FROM || user;
    if (!user || !password || !from)
        return;
    const host = process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.EMAIL_SMTP_PORT || '465');
    if (!Number.isInteger(port) || port < 1 || port > 65535)
        return;
    const secure = process.env.EMAIL_SMTP_SECURE !== 'false';
    const localDevelopment = process.env.NODE_ENV !== 'production' && ['127.0.0.1', 'localhost'].includes(host);
    return { user, password, from, host, port, secure, localDevelopment };
}
const mailGlobals = globalThis as typeof globalThis & {
    ikhwaanMailer?: {
        key: string;
        promise: Promise<Transporter>;
    };
};
async function sharedMailer(config: NonNullable<ReturnType<typeof emailConfiguration>>) {
    const key = JSON.stringify(config);
    if (mailGlobals.ikhwaanMailer?.key === key)
        return mailGlobals.ikhwaanMailer.promise;
    const previous = mailGlobals.ikhwaanMailer;
    const pending = (async () => {
        if (previous)
            await previous.promise.then(mailer => mailer.close()).catch(() => { });
        const { default: nodemailer } = await import('nodemailer');
        return nodemailer.createTransport({
            pool: true, maxConnections: 2, maxMessages: 100,
            host: config.host, port: config.port, secure: config.secure,
            auth: { user: config.user, pass: config.password },
            requireTLS: !config.secure && !config.localDevelopment, ignoreTLS: config.localDevelopment,
            connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
        });
    })();
    mailGlobals.ikhwaanMailer = { key, promise: pending };
    try {
        return await pending;
    }
    catch (error) {
        if (mailGlobals.ikhwaanMailer?.promise === pending)
            delete mailGlobals.ikhwaanMailer;
        throw error;
    }
}
export async function closeEmailConnections() {
    const previous = mailGlobals.ikhwaanMailer;
    delete mailGlobals.ikhwaanMailer;
    if (previous)
        await previous.promise.then(mailer => mailer.close()).catch(() => { });
}
export async function sendEmail(message: EmailMessage, transport?: EmailTransport) {
    const config = emailConfiguration();
    if (!transport && !config)
        throw new Error('Email delivery is not configured.');
    const mailer = transport || await sharedMailer(config!);
    const result = await mailer.sendMail(message);
    if (!result.accepted?.length || result.rejected?.length)
        throw new Error('Email provider did not confirm acceptance.');
}
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
