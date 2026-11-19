// Read-only browser layout audit against disposable accounts and financial fixtures.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, createHmac } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
const directory = await mkdtemp(join(tmpdir(), 'ikhwaan-responsive-'));
const artifacts = join(tmpdir(), 'ikhwaan-responsive-artifacts'); await mkdir(artifacts, { recursive: true });
const dist = `.next-responsive-qa-${process.pid}`;
const secret = randomBytes(32).toString('hex'), base = 'http://127.0.0.1:3019';
const fields = { number: '10000000001', name: 'Responsive Test Member With A Long Name', email: 'responsive.member@example.test', password: '', profileStatus: 'Submitted', status: 'Active', phone: '08000000000', address: 'A long example address for testing layouts on a narrow device', occupation: 'Engineer', officeAddress: 'Example cooperative address', nationality: 'Nigerian', state: 'Lagos', lga: 'Ikeja', gender: 'Female', kinName: 'Example Next of Kin', kinRelationship: 'Sister', kinAddress: 'Example address', kinPhone: '08000000001', kinEmail: 'kin@example.test', outstanding: 0 };
const member = { ...fields, id: 'member', role: 'member', bankAccount: { bankName: 'Example Bank', accountName: fields.name, accountNumber: '0123456789', savedAt: new Date().toISOString() } };
const admin = { ...fields, id: 'admin', role: 'admin', email: 'admin@example.test' };
const state = { members: [member, admin], loans: [], withdrawals: [], announcements: [{ id: 'announcement', title: 'Community update and annual gathering', body: 'An example announcement to check long text and mobile wrapping.', category: 'General', createdAt: new Date().toISOString() }], transactions: [{ id: 'saving', memberId: 'member', date: new Date().toISOString(), description: 'Savings deposit', type: 'Savings', amount: 2000000, reference: 'ikh_00000000-0000-0000-0000-000000000001', status: 'Completed' }], payments: [{ id: 'fee', memberId: 'member', reference: 'ikh_00000000-0000-0000-0000-000000000002', amount: 3000000, currency: 'NGN', status: 'Successful', purpose: 'Membership fee', createdAt: new Date().toISOString() }], paymentSettings: { enabled: false, membershipFee: 3000000 }, contributionPlans: [{ id: 'welfare', title: 'Community welfare and annual family gathering', description: 'Contributions to support our members and families.', amount: 500000, frequency: 'Monthly', startsOn: '2026-01', active: true, createdAt: new Date().toISOString() }], elections: [], dividends: [], audit: [] };
await writeFile(join(directory, 'portal.json'), JSON.stringify(state));
let server, browser, socket, logs = '';
const pending = new Map(); let serial = 0;
function call(method, params = {}) { return new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error('Browser evaluation failed'); return result.result.value; }
function cookie(id) { const payload = Buffer.from(JSON.stringify({ id, version: 0, expires: Date.now() + 3600000 })).toString('base64url'); return payload + '.' + createHmac('sha256', secret).update(payload).digest('hex'); }
const results = [];
try {
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3019'], { env: { ...process.env, MONGODB_URI: '', PORTAL_DATA_DIR: directory, SESSION_SECRET: secret, NEXT_DIST_DIR: dist, PAYSTACK_SECRET_KEY: '', PAYSTACK_WEBHOOK_SECRET: '', NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', d => { logs = (logs + d).slice(-3000); }); server.stderr.on('data', d => { logs = (logs + d).slice(-3000); });
    let ready = false;
    for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/api/auth')).ok) { ready = true; break; } } catch {} await pause(300); }
    if (!ready) throw new Error('Isolated server failed to start: ' + logs);
    browser = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--remote-debugging-port=9237', '--user-data-dir=' + join(directory, 'chrome'), 'about:blank'], { stdio: 'ignore' });
    let target;
    for (let i = 0; i < 60; i++) { try { target = await (await fetch('http://127.0.0.1:9237/json/new?about:blank', { method: 'PUT' })).json(); break; } catch {} await pause(250); }
    if (!target?.webSocketDebuggerUrl) throw new Error('Chrome did not start');
    socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { socket.onopen = r; socket.onerror = j; });
    socket.onmessage = event => { const message = JSON.parse(event.data); const item = pending.get(message.id); if (item) { pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); } };
    await call('Page.enable'); await call('Network.enable');
    const routes = ['/portal', '/portal/savings', '/portal/payments', '/portal/membership', '/portal/membership/edit', '/portal/loans', '/admin', '/admin/members', '/admin/transactions', '/admin/transactions/new', '/admin/contributions', '/admin/contributions/new', '/admin/payments', '/admin/payments/settings', '/admin/loans/settings'];
    for (const width of [320, 375, 768, 1024, 1440]) {
        await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        for (const route of routes) {
            await call('Network.setCookie', { name: 'ikhwaan_session', value: cookie(route.startsWith('/admin') ? 'admin' : 'member'), url: base, httpOnly: true });
            await call('Page.navigate', { url: base + route });
            let loaded = false;
            for (let i = 0; i < 100; i++) { await pause(100); if (await evaluate(`location.pathname===${JSON.stringify(route)} && !!document.querySelector('.sidebar-footer strong') && !document.querySelector('.workspace-skeleton')`)) { loaded = true; break; } }
            const result = await evaluate(`({width:innerWidth,documentWidth:document.documentElement.scrollWidth, overflow:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2&&!e.closest('.table-scroll')}).slice(0,8).map(e=>({tag:e.tagName,class:e.className,right:Math.round(e.getBoundingClientRect().right)}))})`);
            results.push({ route, width, loaded, ...result });
            if (width === 375 && ['/portal/savings', '/admin/contributions/new', '/admin/payments/settings'].includes(route)) { const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(join(artifacts, route.replaceAll('/', '_') + '-375.png'), Buffer.from(shot.data, 'base64')); }
        }
        console.log(JSON.stringify({ width, checked: routes.length, failures: results.filter(r => r.width === width && (!r.loaded || r.documentWidth > width + 2 || r.overflow.length)).map(r => ({ route:r.route,loaded:r.loaded,documentWidth:r.documentWidth,overflow:r.overflow })) }));
        if (width === 375) {
            await evaluate(`document.querySelector('.menu-button').click()`); await pause(150);
            if (!(await evaluate(`document.querySelector('.sidebar').classList.contains('open') && document.querySelector('.main-shell').inert`))) throw new Error('Mobile drawer failed to open');
            await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' }); await pause(100);
            if (await evaluate(`document.querySelector('.sidebar').classList.contains('open')`)) throw new Error('Escape failed to close drawer');
        }
    }
    await writeFile(join(artifacts, 'results.json'), JSON.stringify(results, null, 2));
    console.log('Artifacts: ' + artifacts);
} finally {
    socket?.close();
    for (const child of [browser, server]) if (child && child.exitCode === null) { child.kill('SIGTERM'); await Promise.race([new Promise(r => child.once('exit', r)), pause(2000)]); if (child.exitCode === null) child.kill('SIGKILL'); }
    await rm(directory, { recursive: true, force: true }); await rm(dist, { recursive: true, force: true });
    const path = 'tsconfig.json', config = JSON.parse(await readFile(path, 'utf8')); config.include = config.include.filter(v => v !== `${dist}/types/**/*.ts`); await writeFile(path, JSON.stringify(config, null, 2) + '\n');
    const nextEnv = await readFile('next-env.d.ts', 'utf8'); await writeFile('next-env.d.ts', nextEnv.replace(`./${dist}/types/routes.d.ts`, './.next/types/routes.d.ts'));
}
