'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
export default function EmailSignIn({ adminLogin = false, nextPath }: { adminLogin?: boolean; nextPath?: string }) {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [challengeId, setChallengeId] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [countdown, setCountdown] = useState(0);
    const codeInput = useRef<HTMLInputElement>(null);
    const errorRef = useRef<HTMLParagraphElement>(null);
    useEffect(() => { if (challengeId) codeInput.current?.focus(); }, [challengeId]);
    useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
    useEffect(() => { if (!countdown) return; const timer = setTimeout(() => setCountdown(n => Math.max(0, n - 1)), 1000); return () => clearTimeout(timer); }, [countdown]);
    async function requestCode() {
        if (busy) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request-otp', email }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to send code.');
            setEmail(result.email); setChallengeId(result.challengeId); setCode(''); setCountdown(result.resendAfter || 60); setNotice('A new code has been sent. Check your inbox and spam folder.');
        } catch (e) { setError(e instanceof Error ? e.message : 'Unable to send code. Try again.'); }
        finally { setBusy(false); }
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!challengeId) { await requestCode(); return; }
        if (busy) return;
        setBusy(true); setError('');
        try {
            const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify-otp', challengeId, code, portal: adminLogin ? 'admin' : 'member', next: nextPath }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to verify code.');
            router.replace(result.redirectTo); router.refresh();
        } catch (e) { setError(e instanceof Error ? e.message : 'Unable to verify. Try again.'); }
        finally { setBusy(false); }
    }
    return <main className="auth"><section className="auth-story"><div className="brand"><div>IKHWAAN<small>MULTIPURPOSE COOPERATIVE</small></div></div><div><h1>Grow together.</h1><p>One account for your membership, savings and cooperative journey.</p></div></section><section className="auth-form"><span className="stat-icon green">{challengeId ? <ShieldCheck size={24}/> : <Mail size={24}/>}</span><h2>{challengeId ? 'Check your email' : adminLogin ? 'Administration' : 'Welcome to Ikhwaan'}</h2><p>{challengeId ? `Enter the 6-digit code sent to ${email}. It expires in 10 minutes.` : 'Enter your email to sign in or create an account. We’ll send you a one-time code—no password needed.'}</p><form onSubmit={submit} aria-busy={busy}>{!challengeId ? <label>Email address<input name="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" maxLength={254} required disabled={busy}/></label> : <label>Verification code<input ref={codeInput} className="otp-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required disabled={busy}/></label>}{error && <p ref={errorRef} tabIndex={-1} role="alert" className="error">{error}</p>}{notice && challengeId && <p role="status" className="auth-notice">{notice}</p>}<button className="button primary" disabled={busy}>{busy ? 'Please wait…' : challengeId ? 'Verify & continue' : 'Continue with email'}<ArrowRight size={18}/></button></form>{challengeId && <div className="otp-help"><button className="text-button" type="button" disabled={busy || countdown > 0} onClick={() => void requestCode()}>{countdown ? `Resend code in ${countdown}s` : 'Resend code'}</button><button className="text-button" type="button" disabled={busy} onClick={() => { setChallengeId(''); setCode(''); setError(''); setNotice(''); }}>Use a different email</button></div>}{!challengeId && <p className="auth-switch">New here? You’ll complete your profile after verifying your email.</p>}<p className="auth-switch"><a href={adminLogin ? '/' : '/admin/login'}>{adminLogin ? 'Member sign in' : 'Administration'}</a></p></section></main>;
}
