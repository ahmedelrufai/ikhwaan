type Activity = { actor: string; action: string; subject?: { type: string; id: string } };
export function activityMemberId(activity: Activity, members: { id: string; number: string }[]) {
    if (activity.subject?.type === 'member') return members.some(m => m.id === activity.subject!.id) ? activity.subject.id : null;
    if (!/^(membership application|membership \d|member\b|profile\b)/i.test(activity.action)) return null;
    const target = members.find(m => new RegExp(`\\b${m.number}\\b`).test(activity.action));
    return target?.id || members.find(m => m.id === activity.actor)?.id || null;
}
