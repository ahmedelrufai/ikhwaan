import Link from 'next/link';
export default function MemberPageNotFound() {
    return <section className="panel portal-form-page"><h2>Page not found</h2><p>This record is unavailable or does not belong to your account.</p><Link className="button primary" href="/portal">Back to overview</Link></section>;
}
