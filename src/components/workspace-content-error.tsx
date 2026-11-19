'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
export default function WorkspaceContentError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const router = useRouter();
    const [pending, retry] = useTransition();
    return <section className="panel workspace-load-error"><h2>We couldn’t load this page</h2><p role="alert">Please try again in a moment.</p><button className="button primary" disabled={pending} onClick={() => retry(() => { router.refresh(); reset(); })}>{pending ? 'Retrying…' : 'Try again'}</button></section>;
}
