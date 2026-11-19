export function memberDashboardAllowed(member: { role: string; status: string; profileStatus?: string }) {
    return member.role === 'member' && member.status === 'Active' && member.profileStatus !== 'Incomplete';
}
export function accountDestination(member: { role: string; status: string; profileStatus?: string }) {
    if (member.role === 'admin') return '/admin';
    if (member.profileStatus === 'Incomplete') return '/complete-profile';
    return memberDashboardAllowed(member) ? '/portal' : '/application-status';
}
export function administrativeAccess(member: { role: string; status: string; office?: string; profileStatus?: string }) {
    return member.status === 'Active' && member.profileStatus !== 'Incomplete' && (member.role === 'admin' || member.role === 'member' && ['President', 'Secretary General', 'Treasurer', 'Financial Secretary'].includes(member.office || ''));
}
