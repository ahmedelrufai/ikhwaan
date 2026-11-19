'use client';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Leaf } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import GenderSelect from '@/components/gender-select';
import { ActionButton } from '@/components/action-feedback';
import type { MemberProfile } from '@/lib/profiles';
const personalFields = [['name', 'Full name'], ['phone', 'Mobile number'], ['address', 'Home address'], ['occupation', 'Occupation'], ['officeAddress', 'Office address'], ['nationality', 'Nationality'], ['state', 'State of origin'], ['lga', 'Local government']] as const;
const kinFields = [['kinName', 'Full name'], ['kinRelationship', 'Relationship to you'], ['kinAddress', 'Home address'], ['kinPhone', 'Mobile number'], ['kinEmail', 'Email address']] as const;
export default function CompleteProfile({ email, profile }: { email: string; profile?: MemberProfile }) {
    const router = useRouter();
    const [stage, setStage] = useState(profile?.personal ? 2 : 1);
    const [saved, setSaved] = useState(profile);
    const [kinDraft, setKinDraft] = useState<Record<string, string>>({});
    const formRef = useRef<HTMLFormElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const heading = useRef<HTMLHeadingElement>(null);
    function changeStage(next: number) { setStage(next); setError(''); requestAnimationFrame(() => heading.current?.focus()); }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (busy) return;
        const fields = Object.fromEntries(new FormData(event.currentTarget));
        setBusy(true); setError('');
        try {
            const response = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, stage: stage === 1 ? 'personal' : 'next-of-kin' }) });
            const result = await response.json();
            if (response.status === 401) { window.location.assign('/'); return; }
            if (!response.ok) throw new Error(result.error || 'Unable to save profile.');
            setSaved(result.profile);
            if (stage === 1) changeStage(2);
            else { router.replace(result.redirectTo); router.refresh(); }
        } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save. Try again.'); }
        finally { setBusy(false); }
    }
    const values = { ...saved?.personal, ...saved?.nextOfKin, ...kinDraft } as Record<string, string>;
    return <main className="profile-onboarding"><section className="onboarding-card"><header className="onboarding-header"><div className="brand"><Leaf size={24}/>IKHWAAN</div><ActionButton className="text-button" disabled={busy} onAction={async () => { const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); if (!response.ok) throw new Error('Unable to sign out.'); window.location.assign('/'); }}>Sign out</ActionButton></header><p className="onboarding-email"><Check size={15}/>Email verified · {email}</p><h1>Complete your membership profile</h1><p className="onboarding-intro">Tell us about yourself and your next of kin. We save each completed stage. Your profile goes to an administrator after both stages are complete.</p><ol className="onboarding-steps" aria-label="Profile stages"><li className={stage === 1 ? 'current' : 'done'} aria-current={stage === 1 ? 'step' : undefined}><span>{stage === 2 ? <Check size={15}/> : '1'}</span>Personal profile</li><li className={stage === 2 ? 'current' : ''} aria-current={stage === 2 ? 'step' : undefined}><span>2</span>Next of kin</li></ol><form ref={formRef} key={stage} onSubmit={submit} aria-busy={busy}><h2 ref={heading} tabIndex={-1}>{stage === 1 ? 'Your personal profile' : 'Your next of kin'}</h2><p className="form-hint">{stage === 1 ? 'All fields are required. Your email belongs to your account and is already verified.' : 'Provide a person the cooperative can contact if needed. All fields are required.'}</p><fieldset disabled={busy} className="onboarding-fields"><div className="registration-grid">{(stage === 1 ? personalFields : kinFields).map(([name, label]) => <label key={name}>{label}<input name={name} type={name === 'kinEmail' ? 'email' : name.includes('Phone') || name === 'phone' ? 'tel' : 'text'} autoComplete={name === 'name' ? 'name' : name === 'phone' ? 'tel' : name === 'address' ? 'street-address' : 'off'} defaultValue={values[name] || ''} maxLength={name === 'kinEmail' ? 254 : 500} required/></label>)}{stage === 1 && <label>Gender<GenderSelect defaultValue={values.gender}/></label>}</div></fieldset>{error && <p role="alert" className="error">{error}</p>}<footer className="onboarding-footer">{stage === 2 ? <button type="button" className="button secondary" disabled={busy} onClick={() => { if (formRef.current) setKinDraft(Object.fromEntries(new FormData(formRef.current)) as Record<string, string>); changeStage(1); }}><ArrowLeft size={16}/>Back to personal profile</button> : <span>Step 1 of 2</span>}<button className="button primary" disabled={busy}>{busy ? 'Saving…' : stage === 1 ? 'Save & continue' : 'Submit for approval'}<ArrowRight size={16}/></button></footer></form><p className="onboarding-footnote">Dashboard access opens after your profile is approved.</p></section></main>;
}
