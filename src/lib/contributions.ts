import { randomUUID } from 'node:crypto';
import * as yup from 'yup';
import { amountInKobo } from './rules.ts';
import { audit, type ContributionPlan, type Member, type State } from './store.ts';
import { administrativeAccess } from './access.ts';

export function contributionPlans(state: Pick<State, 'contributionPlans' | 'paymentSettings'>): ContributionPlan[] {
    const plans = state.contributionPlans || [];
    // Keep the original general contribution available until an administrator pauses it.
    if (state.paymentSettings?.contributionAmount && !plans.some(p => p.id === 'legacy-general')) return [{ id: 'legacy-general', title: 'General contribution', description: 'Existing cooperative contribution', amount: state.paymentSettings.contributionAmount, frequency: 'Once', startsOn: '2020-01', active: true, createdAt: '2020-01-01T00:00:00Z' }, ...plans];
    return plans;
}
export function saveContributionPlan(state: State, actor: Member, input: Record<string, unknown>, now = new Date()) {
    if (!administrativeAccess(actor)) throw new Error('Administrator access required.');
    const body = yup.object({ id: yup.string().max(100).optional(), title: yup.string().trim().required().max(120), description: yup.string().trim().max(1000).default(''), amount: yup.string().required(), frequency: yup.mixed<ContributionPlan['frequency']>().oneOf(['Once', 'Monthly', 'Quarterly', 'Yearly']).required(), startsOn: yup.string().matches(/^(20\d{2})-(0[1-9]|1[0-2])$/).required(), active: yup.boolean().required() }).validateSync(input, { stripUnknown: true });
    const existing = body.id ? contributionPlans(state).find(p => p.id === body.id) : undefined;
    if (body.id && !existing) throw new Error('Contribution not found.');
    if (existing && state.payments?.some(p => p.contributionId === existing.id || existing.id === 'legacy-general' && p.purpose === 'Contribution' && !p.contributionId) && (existing.frequency !== body.frequency || existing.startsOn !== body.startsOn)) throw new Error('The schedule cannot change after payments have been started. Create a new contribution instead.');
    const plan: ContributionPlan = { id: existing?.id || randomUUID(), title: body.title, description: body.description, amount: amountInKobo(body.amount), frequency: body.frequency, startsOn: body.startsOn, active: body.active, createdAt: existing?.createdAt || now.toISOString() };
    state.contributionPlans = [...(state.contributionPlans || []).filter(p => p.id !== plan.id), plan];
    audit(state, actor.id, `Contribution ${plan.title}: ${plan.frequency}, ${plan.amount} kobo, ${plan.active ? 'open' : 'paused'}`);
    return plan;
}
