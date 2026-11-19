import { NextResponse } from 'next/server';
import { currentMember, sameOrigin } from '@/lib/auth';
import { accountDestination } from '@/lib/access';
import { saveProfileStage } from '@/lib/profiles';
import { publicMember, withState } from '@/lib/store';
export async function GET() {
    const actor = await currentMember();
    if (!actor) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
    if (actor.role !== 'member') return NextResponse.json({ error: 'Member account required.' }, { status: 403 });
    return withState(state => NextResponse.json({ member: publicMember(actor), profile: state.memberProfiles?.find(p => p.memberId === actor.id) || null }, { headers: { 'Cache-Control': 'no-store' } }));
}
export async function POST(request: Request) {
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
    const actor = await currentMember();
    if (!actor) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
    try {
        const input = await request.json();
        if (!input || typeof input !== 'object') throw new Error('Invalid profile.');
        const result = await withState(state => {
            const member = state.members.find(m => m.id === actor.id);
            if (!member) throw new Error('Account not found.');
            const profile = saveProfileStage(state, member, input);
            return { profile, redirectTo: accountDestination(member) };
        }, true);
        return NextResponse.json(result);
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save profile.' }, { status: 400 }); }
}
