import type { ContributionPlan } from './store.ts';
export function contributionPeriods(plan: ContributionPlan, now = new Date()): { value: string; label: string }[] {
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit' }).formatToParts(now);
    const current = Number(month.find(p => p.type === 'year')!.value) * 12 + Number(month.find(p => p.type === 'month')!.value) - 1;
    const [year, startMonth] = plan.startsOn.split('-').map(Number);
    const start = year * 12 + startMonth - 1;
    if (start > current) return [];
    if (plan.frequency === 'Once') return [{ value: 'once', label: 'One-time contribution' }];
    const result: { value: string; label: string }[] = [];
    const step = plan.frequency === 'Monthly' ? 1 : plan.frequency === 'Quarterly' ? 3 : 12;
    for (let index = Math.floor(current / step) * step; index + step > start && result.length < 1200; index -= step) {
        const y = Math.floor(index / 12), m = index % 12;
        const value = plan.frequency === 'Yearly' ? String(y) : plan.frequency === 'Quarterly' ? `${y}-Q${Math.floor(m / 3) + 1}` : `${y}-${String(m + 1).padStart(2, '0')}`;
        const label = plan.frequency === 'Yearly' ? String(y) : plan.frequency === 'Quarterly' ? `Q${Math.floor(m / 3) + 1} ${y}` : new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        result.push({ value, label });
    }
    return result;
}
