'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const router = useRouter();
    const [pending, retry] = useTransition();
    return <main className="loading"><section className="panel application-status"><div className="brand">IKHWAAN</div><h1>We couldn’t load this page</h1><p>The service may be temporarily unavailable. Please try again in a moment.</p><button className="button primary" disabled={pending} onClick={() => retry(() => { router.refresh(); reset(); })}><RefreshCw size={16}/>{pending ? 'Retrying…' : 'Try again'}</button></section></main>;
}
