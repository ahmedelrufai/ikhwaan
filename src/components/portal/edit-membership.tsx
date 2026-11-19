'use client';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { ActionForm } from '@/components/action-feedback';
import GenderSelect from '@/components/gender-select';
import { validateRegistration } from '@/lib/registration';
import { useMemberPortal } from './portal-context';
const sections = [
    { title: 'Personal information', fields: [['name', 'Full name'], ['phone', 'Mobile number'], ['address', 'Home address'], ['occupation', 'Occupation'], ['officeAddress', 'Office address'], ['nationality', 'Nationality'], ['state', 'State of origin'], ['lga', 'Local government']] },
    { title: 'Next of kin', fields: [['kinName', 'Full name'], ['kinRelationship', 'Relationship'], ['kinPhone', 'Mobile number'], ['kinEmail', 'Email'], ['kinAddress', 'Address']] },
];
export default function EditMembershipPage() {
    const { member, busy, action } = useMemberPortal();
    const router = useRouter();
    return <section className="panel portal-form-page"><Link className="text-button" href="/portal/membership">← My membership</Link><h2>Edit your profile</h2><p>Keep your personal and next-of-kin details up to date.</p><ActionForm onSubmit={async event => { event.preventDefault(); const fields = validateRegistration(Object.fromEntries(new FormData(event.currentTarget))); await action({ ...fields, action: 'profile' }, true); router.push('/portal/membership'); }}>{sections.map(section => <fieldset className="registration-section" key={section.title}><legend>{section.title}</legend><div className="registration-grid">{section.fields.map(([key, label]) => <label key={key}>{label}<input name={key} defaultValue={String(member[key as keyof typeof member] || '')} type={key === 'kinEmail' ? 'email' : key === 'phone' || key === 'kinPhone' ? 'tel' : 'text'} maxLength={key === 'kinEmail' ? 254 : 500} required/></label>)}</div></fieldset>)}<label>Gender<GenderSelect defaultValue={member.gender}/></label><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></ActionForm></section>;
}
