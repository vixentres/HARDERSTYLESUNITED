import { TicketItem } from '../../../../types';

export const mapTicketDBToApp = (t: any): TicketItem => ({
    id: t.id,
    group_id: t.group_id,
    status: t.status as any,
    price: Number(t.price || 0),
    paid_amount: Number(t.paid_amount || 0),
    pending_payment: Number(t.pending_payment || 0),
    cost: Number(t.cost || 0),
    assigned_link: t.assigned_link,
    event_name: t.event_name,
    event_id: t.event_id,
    is_unlocked: t.is_unlocked || false,
    is_courtesy: t.is_courtesy || false,
    internal_correlative: t.internal_correlative,
    updated_at: t.updated_at ? new Date(t.updated_at).getTime() : Date.now()
});

export const mapTicketAppToDB = (t: TicketItem) => ({
    id: t.id,
    group_id: t.group_id,
    status: t.status,
    price: t.price,
    paid_amount: t.paid_amount,
    pending_payment: t.pending_payment,
    cost: t.cost,
    assigned_link: t.assigned_link,
    event_name: t.event_name,
    event_id: t.event_id,
    is_unlocked: t.is_unlocked,
    is_courtesy: t.is_courtesy,
    internal_correlative: t.internal_correlative,
    updated_at: t.updated_at ? new Date(t.updated_at).toISOString() : new Date().toISOString()
});
