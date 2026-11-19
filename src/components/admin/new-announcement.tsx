'use client';
import { useAdminWorkspace } from './admin-context';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { ActionForm } from '@/components/action-feedback';
export default function NewAnnouncementPage() {
    const { busy, submit } = useAdminWorkspace();
    const router = useRouter();
    return <><Link className="member-back" href="/admin/announcements">← Back to announcements</Link><section className="panel admin-form-panel"><h2>New announcement</h2><ActionForm onSubmit={async event => { await submit('announcement')(event); router.push('/admin/announcements'); }}><label>Title<input name="title" required maxLength={150}/></label><label>Message<textarea name="body" required rows={4} maxLength={5000}/></label><button className="button primary" disabled={busy}>Publish</button></ActionForm></section></>;
}
