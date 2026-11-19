type Activity = { actor: string; action: string; createdAt: string; subject?: { type: string; id: string } };
export function activityLoanId(activity: Activity, loans: { id: string; memberId: string; createdAt: string }[]) {
    if (activity.subject?.type === 'loan') return loans.some(l => l.id === activity.subject!.id) ? activity.subject.id : null;
    if (!/loan/i.test(activity.action)) return null;
    const named = loans.find(l => activity.action.includes(l.id));
    if (named) return named.id;
    if (!/^Emergency loan submitted/i.test(activity.action)) return null;
    const candidates = loans.filter(l => l.memberId === activity.actor && Math.abs(new Date(l.createdAt).getTime() - new Date(activity.createdAt).getTime()) <= 5000);
    return candidates.length === 1 ? candidates[0].id : null;
}
