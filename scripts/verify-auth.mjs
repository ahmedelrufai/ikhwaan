// Runs the real Next.js APIs against disposable storage and a loopback-only SMTP sink.
// Captured OTPs remain in this process's memory; no real email or payment provider is used.
import assert from 'node:assert/strict';
import { createServer as createSmtpServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
const inbox = [];
let smtpConnections = 0;
const sockets = new Set();
const smtp = createSmtpServer(socket => {
    smtpConnections++; sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.write('220 localhost SMTP test sink\r\n');
    let buffer = '', dataMode = false, to = [], body = '';
    socket.on('data', chunk => {
        buffer += chunk.toString();
        let end;
        while ((end = buffer.indexOf('\r\n')) >= 0) {
            const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
            if (dataMode) {
                if (line === '.') { inbox.push({ to, body }); to = []; body = ''; dataMode = false; socket.write('250 Accepted\r\n'); }
                else body += line.replace(/^\.\./, '.') + '\n';
            } else if (/^(EHLO|HELO)/i.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
            else if (/^AUTH/i.test(line)) socket.write('235 Authenticated\r\n');
            else if (/^RCPT TO:/i.test(line)) { to.push(line.slice(8).trim().replace(/[<>]/g, '')); socket.write('250 OK\r\n'); }
            else if (/^DATA/i.test(line)) { dataMode = true; socket.write('354 End with dot\r\n'); }
            else if (/^QUIT/i.test(line)) { socket.end('221 Bye\r\n'); }
            else socket.write('250 OK\r\n');
        }
    });
});
const sink = createHttpServer((request, response) => {
    if (request.url !== '/inbox') { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(inbox));
});
await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
await new Promise(resolve => sink.listen(0, '127.0.0.1', resolve));
const directory = await mkdtemp(join(tmpdir(), 'ikhwaan-auth-'));
const port = Number(process.env.AUTH_TEST_PORT || 3018), base = `http://127.0.0.1:${port}`;
const dist = `.next-auth-qa-${process.pid}`;
const env = { ...process.env, MONGODB_URI: '', PAYSTACK_SECRET_KEY: 'sk_test_local_integration_only', PAYSTACK_WEBHOOK_SECRET: '', PORTAL_DATA_DIR: directory, NODE_ENV: 'development', SESSION_SECRET: randomBytes(32).toString('hex'), NEXT_DIST_DIR: dist, APP_URL: base, EMAIL_USER: 'test@example.test', EMAIL_PASSWORD: 'test-only', LOAN_EMAIL_FROM: 'test@example.test', EMAIL_SMTP_HOST: '127.0.0.1', EMAIL_SMTP_PORT: String(smtp.address().port), EMAIL_SMTP_SECURE: 'false', TEST_URL: base, TEST_SMTP_INBOX_URL: `http://127.0.0.1:${sink.address().port}/inbox` };
let server;
async function command(args) {
    await new Promise((resolve, reject) => { const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] }); let output = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk); child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(output))); });
}
async function request(path, body, cookie = '') {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json', Origin: base, 'x-forwarded-for': '127.0.0.3' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'manual' });
    return { response, data: (response.headers.get('content-type') || '').includes('json') ? await response.json() : await response.text() };
}
async function login(email, extra = {}) {
    const issued = await request('/api/auth', { action: 'request-otp', email });
    assert.equal(issued.response.status, 200); assert.equal(issued.response.headers.get('set-cookie'), null);
    assert.equal('code' in issued.data, false);
    const code = [...inbox].reverse().find(item => item.to.includes(email))?.body.match(/sign-in code is (\d{6})/)?.[1];
    assert.ok(code);
    const verified = await request('/api/auth', { action: 'verify-otp', challengeId: issued.data.challengeId, code, ...extra });
    assert.equal(verified.response.status, 200);
    assert.ok(verified.response.headers.get('set-cookie').includes('HttpOnly'));
    assert.ok(verified.response.headers.get('set-cookie').includes('SameSite=lax'));
    assert.equal((await request('/api/auth', { action: 'verify-otp', challengeId: issued.data.challengeId, code })).response.status, 400);
    return { ...verified, cookie: verified.response.headers.get('set-cookie').split(';')[0] };
}
try {
    await command(['--experimental-strip-types', 'scripts/seed-test.mjs']);
    const file = join(directory, 'portal.json');
    const seeded = JSON.parse(await readFile(file, 'utf8'));
    seeded.members.push({ ...seeded.members.find(m => m.id === 'qa-admin'), id: 'qa-auth-admin', email: 'auth-admin@example.test', office: undefined, managesLoanPolicy: false });
    const paystackMember = { ...seeded.members.find(m => m.id === 'qa-member'), id: 'qa-paystack-member', email: 'paystack-member@example.test', number: '10000000099', outstanding: 12000 };
    seeded.members.push(paystackMember);
    seeded.loans.push({ id: 'qa-paystack-loan', memberId: paystackMember.id, reference: 'IKH-PAYSTACK-QA', amount: 10000, status: 'Disbursed', repaid: 0, createdAt: new Date().toISOString(), queue: 1, period: '2026-11', terms: { approvedAmount: 10000, totalRepayment: 12000, interestRate: 20, interestAmount: 2000, repaymentTerms: 'Three monthly installments', installments: [{ amount: 4000, dueDate: '2026-12-01' }, { amount: 4000, dueDate: '2027-01-01' }, { amount: 4000, dueDate: '2027-02-01' }], recordedBy: 'qa-admin', recordedAt: new Date().toISOString() } });
    const paystackReference = 'ikh_' + randomUUID();
    seeded.payments = [{ id: 'qa-paystack-payment', purpose: 'Loan repayment', loanId: 'qa-paystack-loan', memberId: paystackMember.id, customerEmail: paystackMember.email, reference: paystackReference, amount: 4000, currency: 'NGN', status: 'Pending', createdAt: new Date().toISOString() }];
    seeded.paymentSettings = { enabled: true, membershipFee: 10000 };
    await writeFile(file, JSON.stringify(seeded));
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = ''; server.stdout.on('data', data => logs = (logs + data).slice(-10000)); server.stderr.on('data', data => logs = (logs + data).slice(-10000));
    let ready = false;
    for (let count = 0; count < 90; count++) {
        if (server.exitCode !== null) throw new Error(`Test server exited: ${logs}`);
        try { if ((await fetch(base + '/api/auth')).ok) { ready = true; break; } } catch { /* Server is still starting. */ }
        await pause(500);
    }
    assert.ok(ready, 'Test server must start');
    await command(['scripts/verify-api.mjs']);
    console.log('Existing portal API checks passed with email OTP authentication.');
    const applicant = await login('onboarding@example.test', { role: 'admin', status: 'Active', next: '/portal?loan=private' });
    assert.equal(applicant.data.member.role, 'member'); assert.equal(applicant.data.redirectTo, '/complete-profile');
    const pages = ['/portal', '/portal/savings', '/portal/loans', '/portal/payments', '/portal/dividends', '/portal/elections', '/portal/announcements', '/portal/bank-account', '/portal/membership', '/portal/loans/new', '/portal/bank-account/add', '/portal/membership/edit', '/portal/membership/withdraw'];
    function expectRedirect(result, destination) {
        if ([307, 308].includes(result.response.status)) assert.equal(result.response.headers.get('location'), destination);
        else { assert.equal(result.response.status, 200); assert.ok(typeof result.data === 'string' && result.data.includes('NEXT_REDIRECT') && result.data.includes(destination)); }
    }
    for (const path of pages) expectRedirect(await request(path, undefined, applicant.cookie), '/complete-profile');
    expectRedirect(await request('/portal/savings'), '/?next=%2Fportal%2Fsavings');

    assert.equal((await request('/api/portal', undefined, applicant.cookie)).response.status, 403);
    assert.equal((await request('/api/admin', undefined, applicant.cookie)).response.status, 403);
    assert.equal((await request('/api/profile', { stage: 'next-of-kin' }, applicant.cookie)).response.status, 400);
    const personal = { stage: 'personal', name: 'Onboarding Member', phone: '08055551111', address: '12 Test Road', occupation: 'Engineer', officeAddress: '14 Test Road', nationality: 'Nigerian', state: 'Lagos', lga: 'Ikeja', gender: 'Female' };
    assert.equal((await request('/api/profile', personal, applicant.cookie)).response.status, 200);
    assert.equal((await request('/api/profile', undefined, applicant.cookie)).data.profile.personal.name, personal.name);
    const admin = await login('auth-admin@example.test', { portal: 'admin', next: '/admin/loans/settings' });
    assert.equal(admin.data.redirectTo, '/admin/loans/settings');
    const adminPages = ['/admin', '/admin/members', '/admin/transactions', '/admin/loans', '/admin/repayments', '/admin/loans/settings', '/admin/withdrawals', '/admin/payments', '/admin/dividends', '/admin/elections', '/admin/announcements', '/admin/audit', '/admin/transactions/new', '/admin/payments/settings', '/admin/dividends/new', '/admin/elections/new', '/admin/announcements/new'];
    for (const path of adminPages) {
        const page = await request(path, undefined, admin.cookie);
        assert.equal(page.response.status, 200, path + ' must render for an administrator');
        assert.ok(!page.data.includes('NEXT_REDIRECT'), path + ' must not redirect an administrator');
        assert.ok(page.data.includes('<aside') && page.data.includes('<header'), path + ' keeps administration chrome while loading');
        assert.ok(page.data.includes('workspace-skeleton'), path + ' provides content skeletons');
        expectRedirect(await request(path, undefined, applicant.cookie), '/complete-profile');
    }
    expectRedirect(await request('/admin/loans/settings'), '/admin/login?next=%2Fadmin%2Floans%2Fsettings');
    expectRedirect(await request('/admin?view=Members', undefined, admin.cookie), '/admin/members');
    expectRedirect(await request('/admin?view=Loan%20settings', undefined, admin.cookie), '/admin/loans/settings');
    const loginPage = await request('/admin/login');
    assert.equal(loginPage.response.status, 200);
    assert.ok(!loginPage.data.includes('Loading administration'));

    assert.equal((await request('/api/admin', { action: 'member-review', id: applicant.data.member.id, status: 'Active' }, admin.cookie)).response.status, 400);
    const kin = { stage: 'next-of-kin', kinName: 'Relative One', kinRelationship: 'Sister', kinAddress: '16 Test Road', kinPhone: '08055552222', kinEmail: 'kin@example.test' };
    assert.equal((await request('/api/profile', kin, applicant.cookie)).data.redirectTo, '/application-status');
    assert.equal((await request('/api/portal', undefined, applicant.cookie)).response.status, 403);
    const adminData = (await request('/api/admin', undefined, admin.cookie)).data;
    assert.ok(!JSON.stringify(adminData).includes('"digest"')); assert.ok(!('emailOtps' in adminData));
    const scopedSections = ['overview', 'members', 'loans', 'repayments', 'loan-settings', 'transactions', 'new-transaction', 'withdrawals', 'payments', 'payment-settings', 'dividends', 'new-dividend', 'elections', 'new-election', 'announcements', 'new-announcement', 'audit'];
    for (const section of scopedSections) {
        const scoped = await request('/api/admin?section=' + section + '&pageSize=10', undefined, admin.cookie);
        assert.equal(scoped.response.status, 200, 'Scoped admin API: ' + section);
        assert.equal(scoped.data.section, section);
        assert.ok(scoped.response.headers.get('server-timing')?.includes('auth;dur='));
        assert.ok(!JSON.stringify(scoped.data).includes('"password"'));
        assert.equal((await request('/api/admin?section=' + section, undefined, applicant.cookie)).response.status, 403);
    }
    const loanRegister = (await request('/api/admin?section=loans&pageSize=10', undefined, admin.cookie)).data;
    assert.ok(loanRegister.loans.length <= 10);
    assert.equal(loanRegister.audit.length, 0); assert.equal(loanRegister.payments.length, 0);
    assert.equal(loanRegister.loanSummary.total, adminData.loans.length);
    assert.equal((await request('/api/admin?section=unknown', undefined, admin.cookie)).response.status, 400);

    assert.equal((await request('/admin/members/' + applicant.data.member.id, undefined, admin.cookie)).response.status, 200);
    const exampleLoan = adminData.loans.find(loan => loan.status !== 'Draft');
    assert.ok(exampleLoan, 'API fixtures must include a submitted loan');
    assert.equal((await request('/admin/loans/' + exampleLoan.id, undefined, admin.cookie)).response.status, 200);

    assert.equal((await request('/api/admin', { action: 'member-review', id: applicant.data.member.id, status: 'Active' }, admin.cookie)).response.status, 200);
    assert.equal((await request('/api/portal', undefined, applicant.cookie)).response.status, 200);
    for (const path of adminPages) expectRedirect(await request(path, undefined, applicant.cookie), '/portal');
    for (const path of pages) {
        const page = await request(path, undefined, applicant.cookie);
        assert.equal(page.response.status, 200, path + ' must render for an approved member');
        assert.ok(!page.data.includes('NEXT_REDIRECT'), path + ' must not redirect an approved member');
        assert.ok(page.data.includes('<aside') && page.data.includes('<header'), path + ' keeps the workspace chrome in its initial HTML');
        assert.ok(page.data.includes('workspace-skeleton'), path + ' provides content skeletons while data loads');
    }
    expectRedirect(await request('/portal?loan=legacy-loan', undefined, applicant.cookie), '/portal/loans/legacy-loan');
    expectRedirect(await request('/portal?payment_reference=PAY-123', undefined, applicant.cookie), '/portal/payments?payment_reference=PAY-123');
    const privateLoan = await request('/portal/loans/not-owned', undefined, applicant.cookie);
    assert.ok(privateLoan.response.status === 404 || privateLoan.data.includes('NEXT_HTTP_ERROR_FALLBACK;404'));

    const payer = await login('paystack-member@example.test');
    const payPage = await request('/portal/loans/qa-paystack-loan/pay', undefined, payer.cookie);
    assert.equal(payPage.response.status, 200);
    const notOwnedPay = await request('/portal/loans/qa-paystack-loan/pay', undefined, applicant.cookie);
    assert.ok(notOwnedPay.response.status === 404 || notOwnedPay.data.includes('NEXT_HTTP_ERROR_FALLBACK;404'));
    assert.equal((await request('/api/payments', { action: 'initialize-loan', loanId: 'qa-paystack-loan', amount: '120.01' }, payer.cookie)).response.status, 400);
    assert.equal((await request('/api/payments', { action: 'initialize-loan', loanId: 'qa-paystack-loan', amount: '10' }, applicant.cookie)).response.status, 400);
    const event = { event: 'charge.success', data: { reference: paystackReference, amount: 4000, currency: 'NGN', status: 'success', customer: { email: paystackMember.email } } };
    const raw = JSON.stringify(event);
    const sendWebhook = () => fetch(base + '/api/payments/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-paystack-signature': createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(raw).digest('hex') }, body: raw });
    assert.equal((await sendWebhook()).status, 200);
    assert.equal((await sendWebhook()).status, 200);
    const repaid = (await request('/api/portal', undefined, payer.cookie)).data;
    assert.equal(repaid.member.outstanding, 8000);
    assert.equal(repaid.loans.find(loan => loan.id === 'qa-paystack-loan').repaid, 4000);
    assert.equal(repaid.loanRepayments.filter(payment => payment.reference === paystackReference).length, 1);
    const verified = await request('/api/payments', { action: 'verify', reference: paystackReference }, payer.cookie);
    assert.equal(verified.data.status, 'Successful'); assert.equal(verified.data.reconciliationStatus, 'Applied');
    assert.equal((await request('/api/payments', { action: 'verify', reference: paystackReference }, applicant.cookie)).response.status, 400);
    assert.equal((await request('/api/profile', personal, applicant.cookie)).response.status, 400);
    assert.equal((await request('/api/auth', { action: 'login', email: 'onboarding@example.test', password: 'legacy-password' })).response.status, 400);
    assert.ok(smtpConnections < inbox.length, 'SMTP connections should be reused across messages');
    console.log('OTP, page/API access, scoped data, pooled SMTP and signed Paystack loan-repayment reconciliation checks passed. No real emails or payments were sent.');
} finally {
    if (server && server.exitCode === null) { server.kill('SIGTERM'); await new Promise(resolve => { server.once('exit', resolve); setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 3000).unref(); }); }
    for (const socket of sockets) socket.destroy();
    await Promise.all([new Promise(resolve => smtp.close(resolve)), new Promise(resolve => sink.close(resolve))]);
    await rm(directory, { recursive: true, force: true });
    await rm(dist, { recursive: true, force: true });
    // Next adds its temporary generated types to these files; remove only our own entries.
    const tsconfig = JSON.parse(await readFile('tsconfig.json', 'utf8'));
    tsconfig.include = tsconfig.include.filter(value => value !== `${dist}/types/**/*.ts`);
    await writeFile('tsconfig.json', JSON.stringify(tsconfig, null, 2) + '\n');
    const nextEnv = await readFile('next-env.d.ts', 'utf8');
    await writeFile('next-env.d.ts', nextEnv.replace(`./${dist}/types/routes.d.ts`, './.next/types/routes.d.ts'));
}
