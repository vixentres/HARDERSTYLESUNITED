import { PurchaseGroup, TicketItem } from '../../../../types';

export const mapGroupDBToApp = (g: any, items: TicketItem[]): PurchaseGroup => ({
    id: g.id,
    user_email: g.user_email,
    seller_email: g.seller_email,
    items: items,
    total_amount: Number(g.total_amount),
    is_full_payment: g.is_full_payment,
    created_at: new Date(g.created_at).getTime(),
    status: g.status,
    event_id: g.event_id
});

export const mapGroupAppToDB = (g: PurchaseGroup) => ({
    id: g.id,
    user_email: g.user_email,
    seller_email: g.seller_email,
    total_amount: g.total_amount,
    is_full_payment: g.is_full_payment,
    status: g.status,
    event_id: g.event_id,
    created_at: new Date(g.created_at).toISOString()
});
