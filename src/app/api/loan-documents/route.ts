import { administrativeAccess } from '@/lib/access';
import { NextResponse } from 'next/server';
import { currentMember, sameOrigin, rateLimit } from '@/lib/auth';
import { findDocument, saveDocument } from '@/lib/loan-documents';
import { audit, withState } from '@/lib/store';
export async function POST(request: Request) {
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
    const member = await currentMember();
    if (!member) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
    if (member.role !== 'member' || member.status !== 'Active') return NextResponse.json({ error: 'Active membership required.' }, { status: 403 });
    if (!rateLimit('document:' + member.id)) return NextResponse.json({ error: 'Too many uploads. Try later.' }, { status: 429 });
    if (Number(request.headers.get('content-length')) > 6 * 1024 * 1024) return NextResponse.json({ error: 'File is too large.' }, { status: 413 });
    try {
        const form = await request.formData(), file = form.get('file');
        if (!(file instanceof File)) throw new Error('Choose a file.');
        const metadata = await saveDocument(member.id, file);
        await withState(state => audit(state, member.id, 'Loan supporting document uploaded'), true);
        return NextResponse.json(metadata);
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed.' }, { status: 400 }); }
}
export async function GET(request: Request) {
    const actor = await currentMember();
    if (!actor) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
    const id = new URL(request.url).searchParams.get('id') || '';
    const file = await findDocument(id);
    if (!file || (file.metadata.memberId !== actor.id && !administrativeAccess(actor))) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    const full = await findDocument(id, true);
    if (!full?.bytes) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    return new Response(new Uint8Array(full.bytes), { headers: { 'Content-Type': full.metadata.contentType, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(full.metadata.name)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
