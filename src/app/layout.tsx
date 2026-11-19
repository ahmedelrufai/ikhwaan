import type { Metadata } from 'next';
import './globals.css';
import NextTopLoader from 'nextjs-toploader';
export const metadata: Metadata = { title: 'Ikhwaan Cooperative', description: 'The membership and financial self-service portal for Ikhwaan Multipurpose Cooperative Society.' };
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body><NextTopLoader color="#176650" height={3} showSpinner={false} shadow="0 0 8px #17665066" zIndex={1600}/>{children}</body></html>; }
